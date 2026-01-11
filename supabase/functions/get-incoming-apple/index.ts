// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
import { generateEmbedding, generateText, cosineSimilarity } from "../_shared/ai.ts";

/**
 * Get Incoming Apple Edge Function
 *
 * HYBRID MATCHING ALGORITHM (Job-Matching Style):
 * 1. Preference satisfaction (hard filter + score) - Do attributes meet stated preferences?
 * 2. Embedding similarity (semantic match) - Vibe/description match
 * 3. Collaborative filtering (graph traversal) - What did similar apples like?
 *
 * This mirrors talent matching: candidate attributes must meet job requirements,
 * and job attributes must meet candidate preferences. Both directions matter.
 *
 * Task Flow:
 * 1. Generate a new apple instance
 * 2. Capture the new apple's communication (attributes and preferences)
 * 3. Generate embedding for the apple
 * 4. Store the new apple in SurrealDB
 * 5. HYBRID MATCH: Filter by preferences, then score with embedding + collaborative
 * 6. Create RELATE edge for the match
 * 7. Communicate matching results back via LLM
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Scoring weights for hybrid algorithm
const WEIGHTS = {
  PREFERENCE: 0.40,     // How well do attributes satisfy preferences (both directions)
  EMBEDDING: 0.35,      // Semantic similarity from descriptions
  COLLABORATIVE: 0.25,  // What similar apples liked (graph-based)
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
  attributes: Fruit["attributes"];
  preferences: Fruit["preferences"];
  embedding?: number[];
  description?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new apple instance
    const apple = generateApple();

    // Step 2: Capture the apple's communication
    const appleAttrs = communicateAttributes(apple);
    const applePrefs = communicatePreferences(apple);
    const fullDescription = `${appleAttrs}\n\n${applePrefs}`;

    // Step 3: Generate embedding for the apple
    const embedding = await generateEmbedding(fullDescription);

    // Step 4: Store the new apple in SurrealDB
    const appleId = `apple_${Date.now()}`;
    await db.query<FruitRecord[]>(`
      CREATE fruit:${appleId} CONTENT {
        type: "apple",
        attributes: ${JSON.stringify(apple.attributes)},
        preferences: ${JSON.stringify(apple.preferences)},
        embedding: ${JSON.stringify(embedding)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 5: HYBRID MATCHING - Preference satisfaction + Embedding + Collaborative filtering
    
    // 5a. Get all oranges with embeddings and attributes
    const oranges = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "orange" AND embedding != NONE;
    `);
    const orangeList = oranges[0] || [];

    // 5b. Collaborative Filtering via Graph Traversal:
    // Find similar apples (by embedding) and see what oranges they matched with
    const similarApplesResult = await db.query<FruitRecord[]>(`
      LET $query_embedding = ${JSON.stringify(embedding)};
      SELECT *, vector::similarity::cosine(embedding, $query_embedding) AS similarity 
      FROM fruit 
      WHERE type = "apple" 
      AND embedding <|5|> $query_embedding;
    `);
    const similarApples = similarApplesResult[0] || [];

    // Get oranges that similar apples matched with (collaborative signal via graph)
    const collaborativeScores = new Map<string, number[]>();
    for (const similarApple of similarApples) {
      // Graph traversal: similar_apple -> matched -> orange
      const matchedOrangesResult = await db.query<Array<{ out: string; score: number }>>(`
        SELECT out, score FROM matched WHERE in = ${similarApple.id};
      `);
      for (const match of (matchedOrangesResult[0] || [])) {
        if (!collaborativeScores.has(match.out)) {
          collaborativeScores.set(match.out, []);
        }
        collaborativeScores.get(match.out)!.push(match.score);
      }
    }

    // 5c. Calculate hybrid scores for each orange
    interface MatchCandidate {
      orange: FruitRecord;
      score: number;
      breakdown: {
        preference: number;
        embedding: number;
        collaborative: number;
        appleToOrange: { score: number; satisfied: string[]; violated: string[] };
        orangeToApple: { score: number; satisfied: string[]; violated: string[] };
      };
    }
    
    let bestMatch: MatchCandidate | null = null;
    const candidates: MatchCandidate[] = [];

    for (const orange of orangeList) {
      if (!orange.embedding) continue;

      // PREFERENCE SATISFACTION (Bidirectional - like job matching)
      // 1. Does the orange satisfy the apple's preferences?
      const appleToOrange = calculatePreferenceSatisfaction(orange.attributes, apple.preferences);
      // 2. Does the apple satisfy the orange's preferences?
      const orangeToApple = calculatePreferenceSatisfaction(apple.attributes, orange.preferences);
      
      // Combined preference score (average of both directions)
      const preferenceScore = (appleToOrange.score + orangeToApple.score) / 2;

      // EMBEDDING SCORE (semantic/vibe match from descriptions)
      const embeddingScore = cosineSimilarity(embedding, orange.embedding);

      // COLLABORATIVE SCORE (what similar apples liked - graph-based)
      const collabScoresForOrange = collaborativeScores.get(orange.id) || [];
      const collaborativeScore = collabScoresForOrange.length > 0
        ? collabScoresForOrange.reduce((a, b) => a + b, 0) / collabScoresForOrange.length
        : 0;

      // HYBRID SCORE
      const hybridScore = 
        (preferenceScore * WEIGHTS.PREFERENCE) +
        (embeddingScore * WEIGHTS.EMBEDDING) +
        (collaborativeScore * WEIGHTS.COLLABORATIVE);

      const candidate: MatchCandidate = {
        orange,
        score: hybridScore,
        breakdown: {
          preference: preferenceScore,
          embedding: embeddingScore,
          collaborative: collaborativeScore,
          appleToOrange,
          orangeToApple,
        },
      };
      
      candidates.push(candidate);

      if (!bestMatch || hybridScore > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    console.log("[Hybrid Match]", bestMatch ? {
      orangeId: bestMatch.orange.id,
      finalScore: bestMatch.score.toFixed(3),
      breakdown: {
        preference: `${(bestMatch.breakdown.preference * 100).toFixed(1)}%`,
        embedding: `${(bestMatch.breakdown.embedding * 100).toFixed(1)}%`,
        collaborative: `${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%`,
      },
      preferenceDetails: {
        appleToOrange: bestMatch.breakdown.appleToOrange,
        orangeToApple: bestMatch.breakdown.orangeToApple,
      }
    } : "No match found");

    let matchAnnouncement = "No matching oranges found yet.";
    let orangeAnnouncement = "";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match with detailed breakdown
      await db.query(`
        RELATE fruit:${appleId} -> matched -> ${bestMatch.orange.id} CONTENT {
          score: ${bestMatch.score},
          preference_score: ${bestMatch.breakdown.preference},
          embedding_score: ${bestMatch.breakdown.embedding},
          collaborative_score: ${bestMatch.breakdown.collaborative},
          matched_at: time::now()
        };
      `);

      // Build preference satisfaction summary for the LLM
      const prefSummary = {
        appleGets: bestMatch.breakdown.appleToOrange.satisfied.length > 0 
          ? `Preferences met: ${bestMatch.breakdown.appleToOrange.satisfied.join(", ")}`
          : "No specific preferences checked",
        appleMisses: bestMatch.breakdown.appleToOrange.violated.length > 0
          ? `Preferences NOT met: ${bestMatch.breakdown.appleToOrange.violated.join(", ")}`
          : "All preferences satisfied!",
        orangeGets: bestMatch.breakdown.orangeToApple.satisfied.length > 0
          ? `Orange's preferences met: ${bestMatch.breakdown.orangeToApple.satisfied.join(", ")}`
          : "No specific preferences from orange",
        orangeMisses: bestMatch.breakdown.orangeToApple.violated.length > 0
          ? `Orange's preferences NOT met: ${bestMatch.breakdown.orangeToApple.violated.join(", ")}`
          : "Apple satisfies all of orange's preferences!",
      };

      // Step 7: Generate factual announcements (no LLM - dry mode for testing)
      // See STYLE.md for playful mode prompts
      matchAnnouncement = `**Match Found: ${bestMatch.orange.id}**

Score: ${(bestMatch.score * 100).toFixed(1)}%
- Preference: ${(bestMatch.breakdown.preference * 100).toFixed(1)}%
- Embedding: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%
- Collaborative: ${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%

${prefSummary.appleGets}
${prefSummary.appleMisses}`;

      orangeAnnouncement = `**New Match: An apple found you!**

Score: ${(bestMatch.score * 100).toFixed(1)}%
- Preference: ${(bestMatch.breakdown.preference * 100).toFixed(1)}%
- Embedding: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%
- Collaborative: ${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%

${prefSummary.orangeGets}
${prefSummary.orangeMisses}`;

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
                  appleId: `fruit:${appleId}`,
                  orangeId: bestMatch.orange.id,
                  score: bestMatch.score,
                  announcements: {
                    forApple: matchAnnouncement,
                    forOrange: orangeAnnouncement,
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

    return new Response(
      JSON.stringify({
        message: "Apple received and processed",
        apple: {
          id: `fruit:${appleId}`,
          description: fullDescription,
        },
        match: bestMatch
          ? {
              orangeId: bestMatch.orange.id,
              score: bestMatch.score,
              announcement: matchAnnouncement,
              orangeAnnouncement: orangeAnnouncement,
              breakdown: bestMatch.breakdown,
            }
          : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing incoming apple:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming apple",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
