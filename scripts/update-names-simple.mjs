/**
 * Update all fruit names to simple ID format (Apple 0, Orange 1, etc.)
 * 
 * Run with: node update-names-simple.mjs
 */

const SURREAL_URL = process.env.SURREAL_URL?.replace("wss://", "https://") || "https://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud";
const SURREAL_NAMESPACE = process.env.SURREAL_NAMESPACE || "clera-namespace";
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "clera-db";
const SURREAL_USER = process.env.SURREAL_USER || "root";
const SURREAL_PASS = process.env.SURREAL_PASS;

if (!SURREAL_PASS) {
  console.error("Error: SURREAL_PASS environment variable is required");
  process.exit(1);
}

async function query(sql) {
  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString("base64"),
      "Accept": "application/json",
      "Content-Type": "text/plain",
      "Surreal-NS": SURREAL_NAMESPACE,
      "Surreal-DB": SURREAL_DATABASE,
    },
    body: sql,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SurrealDB query failed: ${response.status} - ${errorText}`);
  }

  const results = await response.json();
  return results.map(r => r.result);
}

async function main() {
  console.log("Fetching all fruits...");
  
  // Get all fruits
  const results = await query(`SELECT id, type FROM fruit ORDER BY id;`);
  const fruits = results[0] || [];
  
  console.log(`Found ${fruits.length} fruits`);

  // Separate by type and assign sequential numbers
  const apples = fruits.filter(f => f.type === "apple");
  const oranges = fruits.filter(f => f.type === "orange");
  
  console.log(`  - ${apples.length} apples`);
  console.log(`  - ${oranges.length} oranges`);

  let updated = 0;

  // Update apples
  for (let i = 0; i < apples.length; i++) {
    const apple = apples[i];
    const newName = `Apple ${i}`;
    await query(`UPDATE ${apple.id} SET name = "${newName}";`);
    console.log(`  ${apple.id} -> ${newName}`);
    updated++;
  }

  // Update oranges
  for (let i = 0; i < oranges.length; i++) {
    const orange = oranges[i];
    const newName = `Orange ${i}`;
    await query(`UPDATE ${orange.id} SET name = "${newName}";`);
    console.log(`  ${orange.id} -> ${newName}`);
    updated++;
  }

  console.log(`\nDone! Updated ${updated} fruits with simple names.`);
}

main().catch(console.error);
