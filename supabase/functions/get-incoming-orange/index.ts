// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";

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

// CORS headers for local development
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Scoring weights for hybrid algorithm
const WEIGHTS = {
  PREFERENCE: 0.40,     // How well do attributes satisfy preferences (both directions)
  EMBEDDING: 0.35,      // Semantic similarity from descriptions
  COLLABORATIVE: 0.25,  // What similar oranges liked (graph-based)
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new orange instance
    const orange = generateOrange();

    // Step 2: Capture the orange's communication
    // The orange expresses its attributes and preferences
    const orangeAttrs = communicateAttributes(orange);
    const orangePrefs = communicatePreferences(orange);

    // Step 3: Store the new orange in SurrealDB
    // TODO: Implement orange storage logic

    // Step 4: Match the new orange to existing apples
    // TODO: Implement orange matching logic

    // Step 5: HYBRID MATCHING - Preference satisfaction + Embedding + Collaborative filtering
    
    // 5a. Get all apples with embeddings and attributes
    const apples = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "apple" AND embedding != NONE;
    `);
    const appleList = apples[0] || [];

    // 5b. Collaborative Filtering via Graph Traversal:
    // Find similar oranges (by embedding) and see what apples they matched with
    const similarOrangesResult = await db.query<FruitRecord[]>(`
      LET $query_embedding = ${JSON.stringify(embedding)};
      SELECT *, vector::similarity::cosine(embedding, $query_embedding) AS similarity 
      FROM fruit 
      WHERE type = "orange" 
      AND embedding <|5|> $query_embedding;
    `);
    const similarOranges = similarOrangesResult[0] || [];

    // Get apples that similar oranges matched with (collaborative signal via graph)
    const collaborativeScores = new Map<string, number[]>();
    for (const similarOrange of similarOranges) {
      // Graph traversal: similar_orange -> matched -> apple
      const matchedApplesResult = await db.query<Array<{ out: string; score: number }>>(`
        SELECT out, score FROM matched WHERE in = ${similarOrange.id};
      `);
      for (const match of (matchedApplesResult[0] || [])) {
        if (!collaborativeScores.has(match.out)) {
          collaborativeScores.set(match.out, []);
        }
        collaborativeScores.get(match.out)!.push(match.score);
      }
    }

    // 5c. Calculate hybrid scores for each apple
    interface MatchCandidate {
      apple: FruitRecord;
      score: number;
      breakdown: {
        preference: number;
        embedding: number;
        collaborative: number;
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

      // COLLABORATIVE SCORE (what similar oranges liked - graph-based)
      const collabScoresForApple = collaborativeScores.get(apple.id) || [];
      const collaborativeScore = collabScoresForApple.length > 0
        ? collabScoresForApple.reduce((a, b) => a + b, 0) / collabScoresForApple.length
        : 0;

      // HYBRID SCORE
      const hybridScore = 
        (preferenceScore * WEIGHTS.PREFERENCE) +
        (embeddingScore * WEIGHTS.EMBEDDING) +
        (collaborativeScore * WEIGHTS.COLLABORATIVE);

      const candidate: MatchCandidate = {
        apple,
        score: hybridScore,
        breakdown: {
          preference: preferenceScore,
          embedding: embeddingScore,
          collaborative: collaborativeScore,
          orangeToApple,
          appleToOrange,
        },
      };
      
      candidates.push(candidate);

      if (!bestMatch || hybridScore > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    console.log("[Hybrid Match]", bestMatch ? {
      appleId: bestMatch.apple.id,
      finalScore: bestMatch.score.toFixed(3),
      breakdown: {
        preference: `${(bestMatch.breakdown.preference * 100).toFixed(1)}%`,
        embedding: `${(bestMatch.breakdown.embedding * 100).toFixed(1)}%`,
        collaborative: `${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%`,
      },
      preferenceDetails: {
        orangeToApple: bestMatch.breakdown.orangeToApple,
        appleToOrange: bestMatch.breakdown.appleToOrange,
      }
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
          collaborative_score: ${bestMatch.breakdown.collaborative},
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

      // Step 7: Generate LLM announcements for BOTH parties
      const [orangeAnnouncementResult, appleAnnouncementResult] = await Promise.all([
        generateText({
          system: `You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.
IMPORTANT: Be honest about the match quality. If preferences aren't fully met, acknowledge it playfully.`,
          prompt: `A new orange just arrived looking for love! Here's what they said about themselves:

"${orangeAttrs}"

And here's what they're looking for:
"${orangePrefs}"

I found them a match! An apple with these qualities:
${JSON.stringify(bestMatch.apple.attributes, null, 2)}

MATCH ANALYSIS:
- Overall compatibility: ${(bestMatch.score * 100).toFixed(1)}%
- Preference match: ${(bestMatch.breakdown.preference * 100).toFixed(1)}%
- Vibe/semantic match: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%
- Similar oranges also liked this apple: ${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%

Preference details:
- ${prefSummary.orangeGets}
- ${prefSummary.orangeMisses}

Please announce this match! Be honest - if some preferences aren't met, mention it playfully. Focus on what DOES match well.`,
          maxTokens: 256,
        }),
        generateText({
          system: `You are a witty matchmaker for fruits. You're notifying an existing fruit that someone new has found them as a match.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
          prompt: `Great news for an apple! A new orange just joined and found them as their best match!

The orange described themselves as:
"${orangeAttrs}"

The orange is looking for:
"${orangePrefs}"

MATCH ANALYSIS:
- Overall compatibility: ${(bestMatch.score * 100).toFixed(1)}%
- ${prefSummary.appleGets}
- ${prefSummary.appleMisses}

Please announce to the apple that they've been found by this orange! Mention what makes them compatible.`,
          maxTokens: 256,
        }),
      ]);

      matchAnnouncement = orangeAnnouncementResult;
      appleAnnouncement = appleAnnouncementResult;

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
                  orangeId: `fruit:${orangeId}`,
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

    return new Response(
      JSON.stringify({
        message: "Orange received and processed",
        orange: {
          id: `fruit:${orangeId}`,
          description: fullDescription,
        },
        match: bestMatch
          ? {
              appleId: bestMatch.apple.id,
              score: bestMatch.score,
              announcement: matchAnnouncement,
              appleAnnouncement: appleAnnouncement,
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
