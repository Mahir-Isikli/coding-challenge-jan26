// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
import { generateEmbedding, generateText, cosineSimilarity } from "../_shared/ai.ts";

/**
 * Get Incoming Orange Edge Function
 *
 * Task Flow:
 * 1. Generate a new orange instance
 * 2. Capture the new orange's communication (attributes and preferences)
 * 3. Generate embedding for the orange
 * 4. Store the new orange in SurrealDB
 * 5. Match the new orange to existing apples via vector similarity
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
    // Step 1: Generate a new orange instance
    const orange = generateOrange();

    // Step 2: Capture the orange's communication
    const orangeAttrs = communicateAttributes(orange);
    const orangePrefs = communicatePreferences(orange);
    const fullDescription = `${orangeAttrs}\n\n${orangePrefs}`;

    // Step 3: Generate embedding for the orange
    const embedding = await generateEmbedding(fullDescription);

    // Step 4: Store the new orange in SurrealDB
    const orangeId = `orange_${Date.now()}`;
    const createdOrange = await db.query<FruitRecord[]>(`
      CREATE fruit:${orangeId} CONTENT {
        type: "orange",
        attributes: ${JSON.stringify(orange.attributes)},
        preferences: ${JSON.stringify(orange.preferences)},
        embedding: ${JSON.stringify(embedding)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 5: Find best matching apple via vector similarity
    const apples = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "apple" AND embedding != NONE;
    `);

    let bestMatch: { apple: FruitRecord; score: number } | null = null;
    const appleList = apples[0] || [];

    for (const apple of appleList) {
      if (apple.embedding) {
        const score = cosineSimilarity(embedding, apple.embedding);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { apple, score };
        }
      }
    }

    let matchAnnouncement = "No matching apples found yet.";

    if (bestMatch) {
      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${orangeId} -> matched -> ${bestMatch.apple.id} CONTENT {
          score: ${bestMatch.score},
          matched_at: time::now()
        };
      `);

      // Step 7: Generate LLM announcement
      matchAnnouncement = await generateText({
        system: `You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.`,
        prompt: `A new orange just arrived looking for love! Here's what they said about themselves:

"${orangeAttrs}"

And here's what they're looking for:
"${orangePrefs}"

I found them a match! An apple with these qualities:
${JSON.stringify(bestMatch.apple.attributes, null, 2)}

The compatibility score is ${(bestMatch.score * 100).toFixed(1)}%.

Please announce this match in a fun way!`,
        maxTokens: 256,
      });
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
