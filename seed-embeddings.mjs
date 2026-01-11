/**
 * Generate embeddings for all existing fruits in SurrealDB
 */

import { communicateAttributes, communicatePreferences } from './supabase/functions/_shared/generateFruit.ts';

const SURREAL_URL = "https://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud";
const SURREAL_NAMESPACE = "clera-namespace";
const SURREAL_DATABASE = "clera-db";
const SURREAL_USER = "root";
const SURREAL_PASS = "clera-matchmaking-2024!";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "REDACTED_OPENAI_KEY";

const authHeader = "Basic " + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString("base64");

async function surrealQuery(sql) {
  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Accept": "application/json",
      "Content-Type": "text/plain",
      "Surreal-NS": SURREAL_NAMESPACE,
      "Surreal-DB": SURREAL_DATABASE,
    },
    body: sql,
  });
  const results = await response.json();
  return results[0]?.result || [];
}

async function generateEmbedding(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  console.log("Fetching fruits without embeddings...");
  const fruits = await surrealQuery("SELECT * FROM fruit WHERE embedding = NONE OR embedding IS NULL;");
  console.log(`Found ${fruits.length} fruits needing embeddings\n`);

  for (let i = 0; i < fruits.length; i++) {
    const fruit = fruits[i];
    console.log(`Processing ${i + 1}/${fruits.length}: ${fruit.id}`);

    // Generate description
    const attrs = communicateAttributes(fruit);
    const prefs = communicatePreferences(fruit);
    const description = `${attrs}\n\n${prefs}`;

    // Generate embedding
    const embedding = await generateEmbedding(description);

    // Update fruit with embedding and description
    await surrealQuery(`
      UPDATE ${fruit.id} SET 
        embedding = ${JSON.stringify(embedding)},
        description = ${JSON.stringify(description)};
    `);

    // Rate limit - wait 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("\n✅ Done! All fruits now have embeddings.");

  // Verify
  const withEmbeddings = await surrealQuery("SELECT count() FROM fruit WHERE embedding != NONE GROUP ALL;");
  console.log(`Fruits with embeddings: ${withEmbeddings[0]?.count || 0}`);
}

main().catch(console.error);
