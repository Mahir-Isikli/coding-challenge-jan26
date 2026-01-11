// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
import { generateEmbedding, generateText, cosineSimilarity } from "../_shared/ai.ts";

/**
 * Get Incoming Orange Edge Function
 *
 * HYBRID MATCHING ALGORITHM (Job-Matching Style):
 * 1. Preference satisfaction (hard filter + score) - Do attributes meet stated preferences?
 * 2. Embedding similarity (semantic match) - Vibe/description match
 * 3. Collaborative filtering (graph traversal) - What did similar oranges like?
 *
 * This mirrors talent matching: candidate attributes must meet job requirements,
 * and job attributes must meet candidate preferences. Both directions matter.
 *
 * Task Flow:
 * 1. Generate a new orange instance
 * 2. Capture the new orange's communication (attributes and preferences)
 * 3. Generate embedding for the orange
 * 4. Store the new orange in SurrealDB
 * 5. HYBRID MATCH: Filter by preferences, then score with embedding + collaborative
 * 6. Create RELATE edge for the match
 * 7. Communicate matching results back via LLM
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Scoring weights for matching algorithm
// Note: Collaborative filtering removed - not suitable for two-sided matching markets
// where both parties must agree (unlike Netflix where only user preferences matter)
const WEIGHTS = {
  PREFERENCE: 0.55,     // How well do attributes satisfy preferences (both directions)
  EMBEDDING: 0.45,      // Semantic similarity from descriptions
};

/**
 * Calculate how well a fruit's attributes satisfy another fruit's preferences
 * Returns a score from 0 to 1
 */
function calculatePreferenceSatisfaction(
  attributes: Fruit["attributes"],
  preferences: Fruit["preferences"]
): { score: number; satisfied: string[]; violated: string[] } {
  const satisfied: string[] = [];
  const violated: string[] = [];
  
  if (!preferences || Object.keys(preferences).length === 0) {
    return { score: 1, satisfied: [], violated: [] }; // No preferences = fully satisfied
  }

  for (const [key, pref] of Object.entries(preferences)) {
    const attrValue = attributes[key as keyof typeof attributes];
    
    // Handle null/undefined attributes
    if (attrValue === null || attrValue === undefined) {
      continue; // Skip unknown attributes, don't penalize
    }

    // Range preferences: { min?: number, max?: number }
    if (typeof pref === "object" && pref !== null && !Array.isArray(pref)) {
      const rangeReq = pref as { min?: number; max?: number };
      const numValue = attrValue as number;
      
      if (rangeReq.min !== undefined && numValue < rangeReq.min) {
        violated.push(`${key} (${numValue} < min ${rangeReq.min})`);
      } else if (rangeReq.max !== undefined && numValue > rangeReq.max) {
        violated.push(`${key} (${numValue} > max ${rangeReq.max})`);
      } else {
        satisfied.push(key);
      }
    }
    // Array preferences: attribute must be one of the values
    else if (Array.isArray(pref)) {
      if (pref.includes(attrValue)) {
        satisfied.push(key);
      } else {
        violated.push(`${key} (${attrValue} not in [${pref.join(", ")}])`);
      }
    }
    // Boolean or exact match preferences
    else {
      if (attrValue === pref) {
        satisfied.push(key);
      } else {
        violated.push(`${key} (${attrValue} != ${pref})`);
      }
    }
  }

  const totalPrefs = satisfied.length + violated.length;
  const score = totalPrefs > 0 ? satisfied.length / totalPrefs : 1;
  
  return { score, satisfied, violated };
}

interface FruitRecord {
  id: string;
  type: string;
  name?: string;
  attributes: Fruit["attributes"];
  preferences: Fruit["preferences"];
  embedding?: number[];
  description?: string;
}

/**
 * Format a fruit's display name - use actual name if available,
 * otherwise create a friendly format like "Apple #24" from the ID
 */
function formatFruitName(fruit: FruitRecord): string {
  if (fruit.name) return fruit.name;
  
  // Extract number from ID like "fruit:apple_24" -> "Apple #24"
  const match = fruit.id.match(/fruit:(apple|orange)_(\d+)/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${type} #${match[2]}`;
  }
  return fruit.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new orange instance with unique name
    const orange = await generateOrange(db);

    // Step 2: Capture the orange's communication
    const orangeAttrs = communicateAttributes(orange);
    const orangePrefs = communicatePreferences(orange);
    const fullDescription = `${orangeAttrs}\n\n${orangePrefs}`;

    // Step 3: Generate embedding for the orange
    const embedding = await generateEmbedding(fullDescription);

    // Step 4: Store the new orange in SurrealDB
    const orangeId = `orange_${Date.now()}`;
    await db.query<FruitRecord[]>(`
      CREATE fruit:${orangeId} CONTENT {
        type: "orange",
        name: ${JSON.stringify(orange.name)},
        attributes: ${JSON.stringify(orange.attributes)},
        preferences: ${JSON.stringify(orange.preferences)},
        embedding: ${JSON.stringify(embedding)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 5: MATCHING - Preference satisfaction + Embedding similarity
    
    // 5a. Get all apples with embeddings and attributes
    const apples = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "apple" AND embedding != NONE;
    `);
    const appleList = apples[0] || [];

    // 5b. Calculate scores for each apple
    interface MatchCandidate {
      apple: FruitRecord;
      score: number;
      breakdown: {
        preference: number;
        embedding: number;
        orangeToApple: { score: number; satisfied: string[]; violated: string[] };
        appleToOrange: { score: number; satisfied: string[]; violated: string[] };
      };
    }
    
    let bestMatch: MatchCandidate | null = null;
    const candidates: MatchCandidate[] = [];

    for (const apple of appleList) {
      if (!apple.embedding) continue;

      // PREFERENCE SATISFACTION (Bidirectional - like job matching)
      // 1. Does the apple satisfy the orange's preferences?
      const orangeToApple = calculatePreferenceSatisfaction(apple.attributes, orange.preferences);
      // 2. Does the orange satisfy the apple's preferences?
      const appleToOrange = calculatePreferenceSatisfaction(orange.attributes, apple.preferences);
      
      // Combined preference score (average of both directions)
      const preferenceScore = (orangeToApple.score + appleToOrange.score) / 2;

      // EMBEDDING SCORE (semantic/vibe match from descriptions)
      const embeddingScore = cosineSimilarity(embedding, apple.embedding);

      // FINAL SCORE (preference + embedding)
      const finalScore = 
        (preferenceScore * WEIGHTS.PREFERENCE) +
        (embeddingScore * WEIGHTS.EMBEDDING);

      const candidate: MatchCandidate = {
        apple,
        score: finalScore,
        breakdown: {
          preference: preferenceScore,
          embedding: embeddingScore,
          orangeToApple,
          appleToOrange,
        },
      };
      
      candidates.push(candidate);

      if (!bestMatch || finalScore > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    // Sort candidates by score (descending) and take top 5
    const rankedCandidates = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    bestMatch = rankedCandidates[0] || null;

    console.log("[Match]", bestMatch ? {
      appleId: bestMatch.apple.id,
      finalScore: bestMatch.score.toFixed(3),
      breakdown: {
        preference: `${(bestMatch.breakdown.preference * 100).toFixed(1)}%`,
        embedding: `${(bestMatch.breakdown.embedding * 100).toFixed(1)}%`,
      },
      preferenceDetails: {
        orangeToApple: bestMatch.breakdown.orangeToApple,
        appleToOrange: bestMatch.breakdown.appleToOrange,
      },
      rankedCount: rankedCandidates.length,
    } : "No match found");

    let matchAnnouncement = "No matching apples found yet.";
    let appleAnnouncement = "";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match with detailed breakdown
      await db.query(`
        RELATE fruit:${orangeId} -> matched -> ${bestMatch.apple.id} CONTENT {
          score: ${bestMatch.score},
          preference_score: ${bestMatch.breakdown.preference},
          embedding_score: ${bestMatch.breakdown.embedding},
          matched_at: time::now()
        };
      `);

      // Build preference satisfaction summary for the LLM
      const prefSummary = {
        orangeGets: bestMatch.breakdown.orangeToApple.satisfied.length > 0 
          ? `Preferences met: ${bestMatch.breakdown.orangeToApple.satisfied.join(", ")}`
          : "No specific preferences checked",
        orangeMisses: bestMatch.breakdown.orangeToApple.violated.length > 0
          ? `Preferences NOT met: ${bestMatch.breakdown.orangeToApple.violated.join(", ")}`
          : "All preferences satisfied!",
        appleGets: bestMatch.breakdown.appleToOrange.satisfied.length > 0
          ? `Apple's preferences met: ${bestMatch.breakdown.appleToOrange.satisfied.join(", ")}`
          : "No specific preferences from apple",
        appleMisses: bestMatch.breakdown.appleToOrange.violated.length > 0
          ? `Apple's preferences NOT met: ${bestMatch.breakdown.appleToOrange.violated.join(", ")}`
          : "Orange satisfies all of apple's preferences!",
      };

      // Step 7: Generate factual announcements (no LLM - dry mode for testing)
      // See STYLE.md for playful mode prompts
      const appleName = formatFruitName(bestMatch.apple);
      
      // Build runner-ups list (positions 2-5)
      const runnerUps = rankedCandidates.slice(1).map((c, i) => {
        return `${i + 2}. ${formatFruitName(c.apple)} (${(c.score * 100).toFixed(1)}%)`;
      });
      const runnerUpsText = runnerUps.length > 0 
        ? `\n\n**Other Candidates:**\n${runnerUps.join("\n")}`
        : "";

      matchAnnouncement = `**Match Found: ${appleName}**

Score: ${(bestMatch.score * 100).toFixed(1)}%
- Preference: ${(bestMatch.breakdown.preference * 100).toFixed(1)}%
- Embedding: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%

${prefSummary.orangeGets}
${prefSummary.orangeMisses}${runnerUpsText}`;

      appleAnnouncement = `**New Match: ${orange.name} found you!**

Score: ${(bestMatch.score * 100).toFixed(1)}%
- Preference: ${(bestMatch.breakdown.preference * 100).toFixed(1)}%
- Embedding: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%

${prefSummary.appleGets}
${prefSummary.appleMisses}`;

      // Step 8: Broadcast to connected clients via Supabase Realtime
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fwqoutllbbwyhrucsvly.supabase.co";
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

      if (SUPABASE_ANON_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
            method: "POST",
            headers: {
              "apikey": SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [{
                topic: "matches",
                event: "new_match",
                payload: {
                  appleId: bestMatch.apple.id,
                  appleName: appleName,
                  orangeId: `fruit:${orangeId}`,
                  orangeName: orange.name,
                  score: bestMatch.score,
                  announcements: {
                    forApple: appleAnnouncement,
                    forOrange: matchAnnouncement,
                  },
                },
              }],
            }),
          });
          console.log("[Realtime] Broadcast sent for match");
        } catch (broadcastError) {
          console.error("[Realtime] Failed to broadcast:", broadcastError);
        }
      }
    }

    // Build ranked candidates for response
    const rankedForResponse = rankedCandidates.map((c, i) => ({
      rank: i + 1,
      appleId: c.apple.id,
      appleName: formatFruitName(c.apple),
      score: c.score,
      breakdown: {
        preference: c.breakdown.preference,
        embedding: c.breakdown.embedding,
      },
    }));

    return new Response(
      JSON.stringify({
        message: "Orange received and processed",
        orange: {
          id: `fruit:${orangeId}`,
          name: orange.name,
          description: fullDescription,
        },
        match: bestMatch
          ? {
              appleId: bestMatch.apple.id,
              appleName: formatFruitName(bestMatch.apple),
              score: bestMatch.score,
              announcement: matchAnnouncement,
              appleAnnouncement: appleAnnouncement,
              breakdown: bestMatch.breakdown,
            }
          : null,
        rankedCandidates: rankedForResponse,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing incoming orange:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming orange",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
