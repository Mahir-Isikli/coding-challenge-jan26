// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";

/**
 * Get Incoming Orange Edge Function
 *
 * HYBRID MATCHING ALGORITHM:
 * 1. Embedding similarity (semantic match) - 60% weight
 * 2. Collaborative filtering (what did similar oranges like?) - 25% weight  
 * 3. Graph popularity (how successful is this apple?) - 15% weight
 *
 * Task Flow:
 * 1. Generate a new orange instance
 * 2. Capture the new orange's communication (attributes and preferences)
 * 3. Generate embedding for the orange
 * 4. Store the new orange in SurrealDB
 * 5. HYBRID MATCH: Combine embedding similarity + graph signals
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
  EMBEDDING: 0.60,      // Semantic similarity
  COLLABORATIVE: 0.25,  // What similar oranges liked
  POPULARITY: 0.15,     // Apple's match success rate
};

interface FruitRecord {
  id: string;
  type: string;
  attributes: Fruit["attributes"];
  preferences: Fruit["preferences"];
  embedding?: number[];
  description?: string;
}

interface AppleGraphStats {
  id: string;
  match_count: number;
  avg_score: number;
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

    // Step 5: HYBRID MATCHING - Combine embedding + graph signals
    
    // 5a. Get all apples with embeddings
    const apples = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "apple" AND embedding != NONE;
    `);
    const appleList = apples[0] || [];

    // 5b. Graph Query: Get popularity stats for all apples (match count + avg score)
    // Using graph traversal: apple <- matched <- orange
    const graphStatsResult = await db.query<AppleGraphStats[]>(`
      SELECT 
        id,
        count(<-matched<-fruit) AS match_count,
        math::mean(<-matched.score) AS avg_score
      FROM fruit 
      WHERE type = "apple";
    `);
    const graphStats = new Map<string, AppleGraphStats>();
    for (const stat of (graphStatsResult[0] || [])) {
      graphStats.set(stat.id, stat);
    }

    // 5c. Collaborative Filtering: Find similar oranges and what apples they liked
    // First find oranges with similar embeddings (top 5)
    const similarOrangesResult = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit 
      WHERE type = "orange" 
      AND embedding != NONE
      ORDER BY vector::similarity::cosine(embedding, ${JSON.stringify(embedding)}) DESC
      LIMIT 5;
    `);
    const similarOranges = similarOrangesResult[0] || [];

    // Get apples that similar oranges matched with (collaborative signal)
    const collaborativeScores = new Map<string, number[]>();
    for (const similarOrange of similarOranges) {
      // Traverse graph: similar_orange -> matched -> apple
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

    // 5d. Calculate hybrid scores for each apple
    let bestMatch: { apple: FruitRecord; score: number; breakdown: { embedding: number; collaborative: number; popularity: number } } | null = null;
    
    // Find max values for normalization
    let maxMatchCount = 1;
    for (const stat of graphStats.values()) {
      if (stat.match_count > maxMatchCount) maxMatchCount = stat.match_count;
    }

    for (const apple of appleList) {
      if (!apple.embedding) continue;

      // Embedding score (0-1)
      const embeddingScore = cosineSimilarity(embedding, apple.embedding);

      // Collaborative score: average of scores from similar oranges' matches with this apple
      const collabScoresForApple = collaborativeScores.get(apple.id) || [];
      const collaborativeScore = collabScoresForApple.length > 0
        ? collabScoresForApple.reduce((a, b) => a + b, 0) / collabScoresForApple.length
        : 0;

      // Popularity score: normalized match count + avg match quality
      const stats = graphStats.get(apple.id);
      const normalizedPopularity = stats 
        ? (stats.match_count / maxMatchCount) * 0.5 + (stats.avg_score || 0) * 0.5
        : 0;

      // HYBRID SCORE
      const hybridScore = 
        (embeddingScore * WEIGHTS.EMBEDDING) +
        (collaborativeScore * WEIGHTS.COLLABORATIVE) +
        (normalizedPopularity * WEIGHTS.POPULARITY);

      if (!bestMatch || hybridScore > bestMatch.score) {
        bestMatch = { 
          apple, 
          score: hybridScore,
          breakdown: {
            embedding: embeddingScore,
            collaborative: collaborativeScore,
            popularity: normalizedPopularity,
          }
        };
      }
    }

    console.log("[Hybrid Match]", bestMatch ? {
      appleId: bestMatch.apple.id,
      finalScore: bestMatch.score.toFixed(3),
      breakdown: {
        embedding: `${(bestMatch.breakdown.embedding * 100).toFixed(1)}%`,
        collaborative: `${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%`,
        popularity: `${(bestMatch.breakdown.popularity * 100).toFixed(1)}%`,
      }
    } : "No match found");

    let matchAnnouncement = "No matching apples found yet.";
    let appleAnnouncement = "";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${orangeId} -> matched -> ${bestMatch.apple.id} CONTENT {
          score: ${bestMatch.score},
          matched_at: time::now()
        };
      `);

      // Step 7: Generate LLM announcements for BOTH parties
      const [orangeAnnouncementResult, appleAnnouncementResult] = await Promise.all([
        generateText({
          system: `You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
          prompt: `A new orange just arrived looking for love! Here's what they said about themselves:

"${orangeAttrs}"

And here's what they're looking for:
"${orangePrefs}"

I found them a match! An apple with these qualities:
${JSON.stringify(bestMatch.apple.attributes, null, 2)}

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.
Score breakdown:
- Semantic match: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%
- Similar oranges liked this apple: ${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%
- Apple's popularity: ${(bestMatch.breakdown.popularity * 100).toFixed(1)}%

Please announce this match in a fun way! You can mention that this was found using both semantic compatibility AND recommendations from similar oranges.`,
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

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.

Please announce to the apple that they've been found by this orange!`,
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
