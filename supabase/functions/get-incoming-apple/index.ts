// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";

/**
 * Get Incoming Apple Edge Function
 *
 * HYBRID MATCHING ALGORITHM:
 * 1. Embedding similarity (semantic match) - 60% weight
 * 2. Collaborative filtering (what did similar apples like?) - 25% weight  
 * 3. Graph popularity (how successful is this orange?) - 15% weight
 *
 * Task Flow:
 * 1. Generate a new apple instance
 * 2. Capture the new apple's communication (attributes and preferences)
 * 3. Generate embedding for the apple
 * 4. Store the new apple in SurrealDB
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
  COLLABORATIVE: 0.25,  // What similar apples liked
  POPULARITY: 0.15,     // Orange's match success rate
};

interface FruitRecord {
  id: string;
  type: string;
  attributes: Fruit["attributes"];
  preferences: Fruit["preferences"];
  embedding?: number[];
  description?: string;
}

interface OrangeGraphStats {
  id: string;
  match_count: number;
  avg_score: number;
}

interface CollaborativeMatch {
  orange_id: string;
  recommender_score: number; // How well the similar apple matched with this orange
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new apple instance
    const apple = generateApple();

    // Step 2: Capture the apple's communication
    // The apple expresses its attributes and preferences
    const appleAttrs = communicateAttributes(apple);
    const applePrefs = communicatePreferences(apple);

    // Step 3: Store the new apple in SurrealDB
    // TODO: Implement apple storage logic

    // Step 4: Match the new apple to existing oranges
    // TODO: Implement apple matching logic

    // Step 5: HYBRID MATCHING - Combine embedding + graph signals
    
    // 5a. Get all oranges with embeddings
    const oranges = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "orange" AND embedding != NONE;
    `);
    const orangeList = oranges[0] || [];

    // 5b. Graph Query: Get popularity stats for all oranges (match count + avg score)
    // Using graph traversal: orange <- matched <- apple
    const graphStatsResult = await db.query<OrangeGraphStats[]>(`
      SELECT 
        id,
        count(<-matched<-fruit) AS match_count,
        math::mean(<-matched.score) AS avg_score
      FROM fruit 
      WHERE type = "orange";
    `);
    const graphStats = new Map<string, OrangeGraphStats>();
    for (const stat of (graphStatsResult[0] || [])) {
      graphStats.set(stat.id, stat);
    }

    // 5c. Collaborative Filtering: Find similar apples and what oranges they liked
    // First find apples with similar embeddings (top 5) using KNN operator
    const similarApplesResult = await db.query<FruitRecord[]>(`
      LET $query_embedding = ${JSON.stringify(embedding)};
      SELECT *, vector::similarity::cosine(embedding, $query_embedding) AS similarity 
      FROM fruit 
      WHERE type = "apple" 
      AND embedding <|5|> $query_embedding;
    `);
    const similarApples = similarApplesResult[0] || [];

    // Get oranges that similar apples matched with (collaborative signal)
    const collaborativeScores = new Map<string, number[]>();
    for (const similarApple of similarApples) {
      // Traverse graph: similar_apple -> matched -> orange
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

    // 5d. Calculate hybrid scores for each orange
    let bestMatch: { orange: FruitRecord; score: number; breakdown: { embedding: number; collaborative: number; popularity: number } } | null = null;
    
    // Find max values for normalization
    let maxMatchCount = 1;
    for (const stat of graphStats.values()) {
      if (stat.match_count > maxMatchCount) maxMatchCount = stat.match_count;
    }

    for (const orange of orangeList) {
      if (!orange.embedding) continue;

      // Embedding score (0-1)
      const embeddingScore = cosineSimilarity(embedding, orange.embedding);

      // Collaborative score: average of scores from similar apples' matches with this orange
      const collabScoresForOrange = collaborativeScores.get(orange.id) || [];
      const collaborativeScore = collabScoresForOrange.length > 0
        ? collabScoresForOrange.reduce((a, b) => a + b, 0) / collabScoresForOrange.length
        : 0;

      // Popularity score: normalized match count + avg match quality
      const stats = graphStats.get(orange.id);
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
          orange, 
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
      orangeId: bestMatch.orange.id,
      finalScore: bestMatch.score.toFixed(3),
      breakdown: {
        embedding: `${(bestMatch.breakdown.embedding * 100).toFixed(1)}%`,
        collaborative: `${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%`,
        popularity: `${(bestMatch.breakdown.popularity * 100).toFixed(1)}%`,
      }
    } : "No match found");

    let matchAnnouncement = "No matching oranges found yet.";
    let orangeAnnouncement = "";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${appleId} -> matched -> ${bestMatch.orange.id} CONTENT {
          score: ${bestMatch.score},
          matched_at: time::now()
        };
      `);

      // Step 7: Generate LLM announcements for BOTH parties
      const [appleAnnouncementResult, orangeAnnouncementResult] = await Promise.all([
        generateText({
          system: `You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
          prompt: `A new apple just arrived looking for love! Here's what they said about themselves:

"${appleAttrs}"

And here's what they're looking for:
"${applePrefs}"

I found them a match! An orange with these qualities:
${JSON.stringify(bestMatch.orange.attributes, null, 2)}

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.
Score breakdown:
- Semantic match: ${(bestMatch.breakdown.embedding * 100).toFixed(1)}%
- Similar apples liked this orange: ${(bestMatch.breakdown.collaborative * 100).toFixed(1)}%
- Orange's popularity: ${(bestMatch.breakdown.popularity * 100).toFixed(1)}%

Please announce this match in a fun way! You can mention that this was found using both semantic compatibility AND recommendations from similar apples.`,
          maxTokens: 256,
        }),
        generateText({
          system: `You are a witty matchmaker for fruits. You're notifying an existing fruit that someone new has found them as a match.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
          prompt: `Great news for an orange! A new apple just joined and found them as their best match!

The apple described themselves as:
"${appleAttrs}"

The apple is looking for:
"${applePrefs}"

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.

Please announce to the orange that they've been found by this apple!`,
          maxTokens: 256,
        }),
      ]);

      matchAnnouncement = appleAnnouncementResult;
      orangeAnnouncement = orangeAnnouncementResult;

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
