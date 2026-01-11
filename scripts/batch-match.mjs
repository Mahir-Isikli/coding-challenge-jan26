/**
 * Batch Match Script
 * 
 * Matches existing fruits in the database against each other.
 * Creates 'matched' relationships for pairs above a score threshold.
 * 
 * Usage: node batch-match.mjs [--threshold=0.8] [--dry-run]
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

const authHeader = "Basic " + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString("base64");

// Parse CLI args
const args = process.argv.slice(2);
const threshold = parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.8');
const dryRun = args.includes('--dry-run');

console.log(`\n🍎🍊 Batch Matching Script`);
console.log(`   Threshold: ${(threshold * 100).toFixed(0)}%`);
console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will create matches)'}\n`);

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
    throw new Error(`SurrealDB error: ${JSON.stringify(results[0])}`);
  }
  return results[0]?.result || [];
}

/**
 * Calculate how well a fruit's attributes satisfy another fruit's preferences
 */
function calculatePreferenceSatisfaction(attributes, preferences) {
  const satisfied = [];
  const violated = [];
  
  if (!preferences || Object.keys(preferences).length === 0) {
    return { score: 1, satisfied: [], violated: [] };
  }

  for (const [key, pref] of Object.entries(preferences)) {
    const attrValue = attributes[key];
    
    if (attrValue === null || attrValue === undefined) {
      continue; // Skip unknown attributes
    }

    // Range preferences: { min?: number, max?: number }
    if (typeof pref === "object" && pref !== null && !Array.isArray(pref)) {
      const rangeReq = pref;
      const numValue = attrValue;
      
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

function formatFruitName(fruit) {
  if (fruit.name) return fruit.name;
  const match = fruit.id.match(/fruit:(apple|orange)_(\d+)/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${type} #${match[2]}`;
  }
  return fruit.id;
}

async function main() {
  // Step 1: Get all fruits
  console.log("📦 Fetching fruits from database...");
  const apples = await surrealQuery("SELECT * FROM fruit WHERE type = 'apple';");
  const oranges = await surrealQuery("SELECT * FROM fruit WHERE type = 'orange';");
  
  console.log(`   Found ${apples.length} apples and ${oranges.length} oranges\n`);

  // Step 2: Get existing matches to avoid duplicates
  console.log("🔗 Checking existing matches...");
  const existingMatches = await surrealQuery("SELECT in, out FROM matched;");
  const existingPairs = new Set(existingMatches.map(m => `${m.in}:${m.out}`));
  console.log(`   Found ${existingMatches.length} existing matches\n`);

  // Step 3: Calculate all possible matches
  console.log("🧮 Calculating match scores...");
  const allMatches = [];
  
  for (const apple of apples) {
    for (const orange of oranges) {
      // Bidirectional preference satisfaction
      const appleToOrange = calculatePreferenceSatisfaction(orange.attributes, apple.preferences);
      const orangeToApple = calculatePreferenceSatisfaction(apple.attributes, orange.preferences);
      
      const score = (appleToOrange.score + orangeToApple.score) / 2;
      
      allMatches.push({
        apple,
        orange,
        score,
        appleToOrange,
        orangeToApple,
        pairKey: `${apple.id}:${orange.id}`,
      });
    }
  }

  // Step 4: Filter by threshold and check for existing
  const qualifyingMatches = allMatches
    .filter(m => m.score >= threshold)
    .filter(m => !existingPairs.has(m.pairKey))
    .sort((a, b) => b.score - a.score);

  console.log(`   Total pairs evaluated: ${allMatches.length}`);
  console.log(`   Pairs above ${(threshold * 100).toFixed(0)}% threshold: ${allMatches.filter(m => m.score >= threshold).length}`);
  console.log(`   New matches to create: ${qualifyingMatches.length}\n`);

  if (qualifyingMatches.length === 0) {
    console.log("✅ No new matches to create. All qualifying pairs already exist.");
    return;
  }

  // Step 5: Show matches to be created
  console.log("📋 Matches to create:");
  console.log("─".repeat(70));
  
  for (const match of qualifyingMatches.slice(0, 20)) {
    const appleName = formatFruitName(match.apple);
    const orangeName = formatFruitName(match.orange);
    console.log(`   ${appleName.padEnd(15)} ↔ ${orangeName.padEnd(15)} Score: ${(match.score * 100).toFixed(1)}%`);
  }
  
  if (qualifyingMatches.length > 20) {
    console.log(`   ... and ${qualifyingMatches.length - 20} more`);
  }
  console.log("─".repeat(70) + "\n");

  if (dryRun) {
    console.log("🔍 DRY RUN - No changes made. Remove --dry-run flag to create matches.\n");
    return;
  }

  // Step 6: Create match relationships
  console.log("🔗 Creating match relationships...");
  let created = 0;
  let errors = 0;

  for (const match of qualifyingMatches) {
    try {
      await surrealQuery(`
        RELATE ${match.apple.id} -> matched -> ${match.orange.id} CONTENT {
          score: ${match.score},
          apple_to_orange_score: ${match.appleToOrange.score},
          orange_to_apple_score: ${match.orangeToApple.score},
          apple_to_orange_satisfied: ${JSON.stringify(match.appleToOrange.satisfied)},
          apple_to_orange_violated: ${JSON.stringify(match.appleToOrange.violated)},
          orange_to_apple_satisfied: ${JSON.stringify(match.orangeToApple.satisfied)},
          orange_to_apple_violated: ${JSON.stringify(match.orangeToApple.violated)},
          matched_at: time::now(),
          batch_matched: true
        };
      `);
      created++;
      
      if (created % 10 === 0) {
        process.stdout.write(`   Created ${created}/${qualifyingMatches.length} matches\r`);
      }
    } catch (err) {
      console.error(`   Error creating match: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n\n✅ Batch matching complete!`);
  console.log(`   Created: ${created} matches`);
  if (errors > 0) console.log(`   Errors: ${errors}`);

  // Step 7: Summary stats
  const totalMatches = await surrealQuery("SELECT count() FROM matched GROUP ALL;");
  console.log(`   Total matches in database: ${totalMatches[0]?.count || 0}\n`);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
