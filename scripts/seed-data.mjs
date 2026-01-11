/**
 * Seed SurrealDB with fruit data from raw_apples_and_oranges.json
 * 
 * Usage: node scripts/seed-data.mjs
 * 
 * Required env vars:
 *   SURREAL_PASS - SurrealDB password
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SURREAL_URL = process.env.SURREAL_URL?.replace("wss://", "https://");
const SURREAL_NAMESPACE = process.env.SURREAL_NAMESPACE;
const SURREAL_DATABASE = process.env.SURREAL_DATABASE;
const SURREAL_USER = process.env.SURREAL_USER;
const SURREAL_PASS = process.env.SURREAL_PASS;

if (!SURREAL_URL || !SURREAL_NAMESPACE || !SURREAL_DATABASE || !SURREAL_USER || !SURREAL_PASS) {
  console.error("Error: Missing required environment variables.");
  console.error("Required: SURREAL_URL, SURREAL_NAMESPACE, SURREAL_DATABASE, SURREAL_USER, SURREAL_PASS");
  process.exit(1);
}

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
  if (results[0]?.status === "ERR") {
    throw new Error(`SurrealDB error: ${results[0].result}`);
  }
  return results[0]?.result || [];
}

async function main() {
  // Load raw data
  const dataPath = join(__dirname, '..', 'data', 'raw_apples_and_oranges.json');
  const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  console.log(`Loading ${rawData.length} fruits into SurrealDB...\n`);

  // Count existing fruits
  const existing = await surrealQuery("SELECT count() FROM fruit GROUP ALL;");
  const existingCount = existing[0]?.count || 0;
  
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing fruits in database.`);
    console.log("To reseed, first run: DELETE fruit;");
    console.log("Then run this script again.\n");
    return;
  }

  let appleCount = 0;
  let orangeCount = 0;

  for (const fruit of rawData) {
    const id = fruit.type === 'apple' ? `apple_${appleCount}` : `orange_${orangeCount}`;
    const name = fruit.type === 'apple' ? `Apple ${appleCount}` : `Orange ${orangeCount}`;
    
    await surrealQuery(`
      CREATE fruit:${id} CONTENT {
        type: "${fruit.type}",
        name: "${name}",
        attributes: ${JSON.stringify(fruit.attributes)},
        preferences: ${JSON.stringify(fruit.preferences)}
      };
    `);

    if (fruit.type === 'apple') appleCount++;
    else orangeCount++;
    
    process.stdout.write(`  Created ${name}\r`);
  }

  console.log(`\n\n✅ Done! Seeded ${appleCount} apples and ${orangeCount} oranges.`);
  
  // Verify
  const total = await surrealQuery("SELECT count() FROM fruit GROUP ALL;");
  console.log(`Total fruits in database: ${total[0]?.count || 0}`);
}

main().catch(console.error);
