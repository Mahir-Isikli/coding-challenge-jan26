// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
import { generateEmbedding, generateText, cosineSimilarity } from "../_shared/ai.ts";

/**
 * Get Incoming Apple Edge Function
 *
 * Task Flow:
 * 1. Generate a new apple instance
 * 2. Capture the new apple's communication (attributes and preferences)
 * 3. Generate embedding for the apple
 * 4. Store the new apple in SurrealDB
 * 5. Match the new apple to existing oranges via vector similarity
 * 6. Create RELATE edge for the match
 * 7. Communicate matching results back via LLM
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const createdApple = await db.query<FruitRecord[]>(`
      CREATE fruit:${appleId} CONTENT {
        type: "apple",
        attributes: ${JSON.stringify(apple.attributes)},
        preferences: ${JSON.stringify(apple.preferences)},
        embedding: ${JSON.stringify(embedding)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 5: Find best matching orange via vector similarity
    const oranges = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "orange" AND embedding != NONE;
    `);

    let bestMatch: { orange: FruitRecord; score: number } | null = null;
    const orangeList = oranges[0] || [];

    for (const orange of orangeList) {
      if (orange.embedding) {
        const score = cosineSimilarity(embedding, orange.embedding);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { orange, score };
        }
      }
    }

    let matchAnnouncement = "No matching oranges found yet.";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${appleId} -> matched -> ${bestMatch.orange.id} CONTENT {
          score: ${bestMatch.score},
          matched_at: time::now()
        };
      `);

      // Step 7: Generate LLM announcement
      matchAnnouncement = await generateText({
        system: `You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
        prompt: `A new apple just arrived looking for love! Here's what they said about themselves:

"${appleAttrs}"

And here's what they're looking for:
"${applePrefs}"

I found them a match! An orange with these qualities:
${JSON.stringify(bestMatch.orange.attributes, null, 2)}

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.

Please announce this match in a fun way!`,
        maxTokens: 256,
      });
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
