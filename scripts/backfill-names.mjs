/**
 * Backfill names for existing fruits in SurrealDB
 * 
 * Run with: node backfill-names.mjs
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

const APPLE_NAMES = [
  "Gala", "Fuji", "Honeycrisp", "Braeburn", "Pippin", "Granny", "Macintosh", "Jonagold",
  "Cortland", "Ambrosia", "Crispin", "Empire", "Jazz", "Envy", "Opal", "Aurora",
  "Pink Lady", "Cosmic", "Snapple", "Liberty", "Fortune", "Autumn", "Sunrise", "Golden",
  "Ruby", "Scarlet", "Rosie", "Blossom", "Orchard", "Newton", "Cider", "Bramley",
  "Spencer", "Baldwin", "Rome", "Winesap", "Cameo", "Kiku", "Smitten", "Rave",
  "Sweetie", "Kanzi", "Rockit", "Pazazz", "Sugar Bee", "Evercrisp", "Juici", "Ludacrisp",
  "Crimson", "Zestar"
];

const ORANGE_NAMES = [
  "Valencia", "Navel", "Clementine", "Tangerine", "Satsuma", "Cara Cara", "Mandarin", "Seville",
  "Jaffa", "Moro", "Sunny", "Zesty", "Marmalade", "Tang", "Julius", "Florida",
  "Rio", "Coral", "Amber", "Goldie", "Blaze", "Sunset", "Tropicana", "Citrus",
  "Bergamot", "Kumquat", "Pixie", "Murcott", "Minneola", "Tangelo", "Hamlin", "Pera",
  "Salustiana", "Shamouti", "Midknight", "Delta", "Trovita", "Parson", "Pineapple", "Temple",
  "Sunburst", "Dancy", "Honey", "Page", "Fairchild", "Fremont", "Nova", "Orlando",
  "Lee", "Fallglo"
];

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
  console.log("Fetching fruits without names...");
  
  // Get all fruits without names
  const results = await query(`SELECT id, type FROM fruit WHERE name = NONE OR name = NULL;`);
  const fruitsWithoutNames = results[0] || [];
  
  console.log(`Found ${fruitsWithoutNames.length} fruits without names`);
  
  if (fruitsWithoutNames.length === 0) {
    console.log("All fruits already have names!");
    return;
  }

  // Get existing names to avoid duplicates
  const existingResults = await query(`SELECT name, type FROM fruit WHERE name != NONE;`);
  const existingFruits = existingResults[0] || [];
  
  const usedAppleNames = new Set(existingFruits.filter(f => f.type === "apple").map(f => f.name));
  const usedOrangeNames = new Set(existingFruits.filter(f => f.type === "orange").map(f => f.name));
  
  console.log(`Already used: ${usedAppleNames.size} apple names, ${usedOrangeNames.size} orange names`);

  // Get available names
  const availableAppleNames = APPLE_NAMES.filter(n => !usedAppleNames.has(n));
  const availableOrangeNames = ORANGE_NAMES.filter(n => !usedOrangeNames.has(n));
  
  console.log(`Available: ${availableAppleNames.length} apple names, ${availableOrangeNames.length} orange names`);

  // Shuffle available names
  const shuffledApples = [...availableAppleNames].sort(() => Math.random() - 0.5);
  const shuffledOranges = [...availableOrangeNames].sort(() => Math.random() - 0.5);

  let appleIndex = 0;
  let orangeIndex = 0;
  let updated = 0;

  for (const fruit of fruitsWithoutNames) {
    let name;
    
    if (fruit.type === "apple") {
      if (appleIndex < shuffledApples.length) {
        name = shuffledApples[appleIndex++];
      } else {
        // Fallback with suffix
        name = `${APPLE_NAMES[appleIndex % APPLE_NAMES.length]}-${Math.floor(Math.random() * 100)}`;
        appleIndex++;
      }
    } else {
      if (orangeIndex < shuffledOranges.length) {
        name = shuffledOranges[orangeIndex++];
      } else {
        // Fallback with suffix
        name = `${ORANGE_NAMES[orangeIndex % ORANGE_NAMES.length]}-${Math.floor(Math.random() * 100)}`;
        orangeIndex++;
      }
    }

    // Update the fruit with the new name
    await query(`UPDATE ${fruit.id} SET name = "${name}";`);
    console.log(`  ${fruit.id} -> ${name}`);
    updated++;
  }

  console.log(`\nDone! Updated ${updated} fruits with names.`);
}

main().catch(console.error);
