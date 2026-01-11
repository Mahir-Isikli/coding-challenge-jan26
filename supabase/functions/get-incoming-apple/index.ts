// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
// Embeddings removed - using 100% preference-based matching

/**
 * Get Incoming Apple Edge Function
 *
 * PREFERENCE-BASED MATCHING (Bidirectional):
 * Calculates how well attributes satisfy preferences in BOTH directions:
 * 1. Does the orange satisfy the apple's preferences?
 * 2. Does the apple satisfy the orange's preferences?
 *
 * Task Flow:
 * 1. Generate a new apple instance
 * 2. Capture the apple's communication (attributes and preferences)
 * 3. Store the new apple in SurrealDB
 * 4. Match based on preference satisfaction (100% preference-based)
 * 5. Create RELATE edge for the match
 * 6. Return data for LLM announcements
 */

// CORS headers for local development
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 100% preference-based matching
// Embeddings removed - explicit preferences are more meaningful than semantic similarity

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
  name?: string;
  attributes: Fruit["attributes"];
  preferences: Fruit["preferences"];
  description?: string;
}

/**
 * Format a fruit's display name - use actual name if available,
 * otherwise create a friendly format like "Orange #24" from the ID
 */
function formatFruitName(fruit: FruitRecord): string {
  if (fruit.name) return fruit.name;
  
  // Extract number from ID like "fruit:orange_24" -> "Orange #24"
  const match = fruit.id.match(/fruit:(apple|orange)_(\d+)/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${type} #${match[2]}`;
  }
  return fruit.id;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new apple instance with unique name
    const apple = await generateApple(db);

    // Step 2: Capture the apple's communication
    // The apple expresses its attributes and preferences
    const appleAttrs = communicateAttributes(apple);
    const applePrefs = communicatePreferences(apple);

    // Step 3: Store the new apple in SurrealDB (no embeddings needed)
    const appleId = `apple_${Date.now()}`;
    await db.query<FruitRecord[]>(`
      CREATE fruit:${appleId} CONTENT {
        type: "apple",
        name: ${JSON.stringify(apple.name)},
        attributes: ${JSON.stringify(apple.attributes)},
        preferences: ${JSON.stringify(apple.preferences)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 4: PREFERENCE-BASED MATCHING (100% preference satisfaction)
    
    // Get all oranges and their existing match counts for fair distribution
    const oranges = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "orange";
    `);
    const orangeList = oranges[0] || [];

    // Get match counts for fair distribution tie-breaking
    const matchCountsResult = await db.query<{ id: string; count: number }[]>(`
      SELECT out as id, count() as count FROM matched GROUP BY out;
    `);
    const matchCounts: Record<string, number> = {};
    for (const row of matchCountsResult[0] || []) {
      matchCounts[row.id] = row.count;
    }
    const getMatchCount = (id: string) => matchCounts[id] || 0;

    // Calculate scores for each orange
    interface MatchCandidate {
      orange: FruitRecord;
      score: number;
      breakdown: {
        appleToOrange: { score: number; satisfied: string[]; violated: string[] };
        orangeToApple: { score: number; satisfied: string[]; violated: string[] };
      };
    }
    
    let bestMatch: MatchCandidate | null = null;
    const candidates: MatchCandidate[] = [];

    for (const orange of orangeList) {
      // PREFERENCE SATISFACTION (Bidirectional)
      // 1. Does the orange satisfy the apple's preferences?
      const appleToOrange = calculatePreferenceSatisfaction(orange.attributes, apple.preferences);
      // 2. Does the apple satisfy the orange's preferences?
      const orangeToApple = calculatePreferenceSatisfaction(apple.attributes, orange.preferences);
      
      // Combined preference score (average of both directions) - this IS the final score
      const finalScore = (appleToOrange.score + orangeToApple.score) / 2;

      const candidate: MatchCandidate = {
        orange,
        score: finalScore,
        breakdown: {
          appleToOrange,
          orangeToApple,
        },
      };
      
      candidates.push(candidate);

      if (!bestMatch || finalScore > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    // Sort candidates by score (descending), then by match count (ascending for fair distribution), then by name
    const rankedCandidates = candidates
      .sort((a, b) => {
        // Primary: score descending
        if (b.score !== a.score) return b.score - a.score;
        // Secondary: fewer existing matches first (fair distribution)
        const countA = getMatchCount(a.orange.id);
        const countB = getMatchCount(b.orange.id);
        if (countA !== countB) return countA - countB;
        // Tertiary: name alphabetically for deterministic tie-breaking
        const nameA = formatFruitName(a.orange);
        const nameB = formatFruitName(b.orange);
        return nameA.localeCompare(nameB);
      })
      .slice(0, 5);
    
    bestMatch = rankedCandidates[0] || null;

    console.log("[Match]", bestMatch ? {
      orangeId: bestMatch.orange.id,
      finalScore: bestMatch.score.toFixed(3),
      preferenceDetails: {
        appleToOrange: bestMatch.breakdown.appleToOrange,
        orangeToApple: bestMatch.breakdown.orangeToApple,
      },
      rankedCount: rankedCandidates.length,
    } : "No match found");

    // Step 5: Calculate "other apples" for the matched orange (for their broadcast)
    // This shows the orange what other apples could also be a good match for them
    let otherApplesForOrange: { appleId: string; appleName: string; score: number }[] = [];
    
    if (bestMatch) {
      // Get all apples to rank from the matched orange's perspective
      const allApples = await db.query<FruitRecord[]>(`
        SELECT * FROM fruit WHERE type = "apple";
      `);
      const appleList = allApples[0] || [];
      
      // Get apple match counts for fair distribution
      const appleMatchCountsResult = await db.query<{ id: string; count: number }[]>(`
        SELECT in as id, count() as count FROM matched GROUP BY in;
      `);
      const appleMatchCounts: Record<string, number> = {};
      for (const row of appleMatchCountsResult[0] || []) {
        appleMatchCounts[row.id] = row.count;
      }
      const getAppleMatchCount = (id: string) => appleMatchCounts[id] || 0;

      // Calculate scores from the orange's perspective
      const appleScores = appleList.map(appleCandidate => {
        const orangeToApple = calculatePreferenceSatisfaction(appleCandidate.attributes, bestMatch.orange.preferences);
        const appleToOrange = calculatePreferenceSatisfaction(bestMatch.orange.attributes, appleCandidate.preferences);
        const score = (orangeToApple.score + appleToOrange.score) / 2;
        return { apple: appleCandidate, score };
      });

      // Sort and get top alternatives (excluding the current apple which is the best match)
      otherApplesForOrange = appleScores
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const countA = getAppleMatchCount(a.apple.id);
          const countB = getAppleMatchCount(b.apple.id);
          if (countA !== countB) return countA - countB;
          return formatFruitName(a.apple).localeCompare(formatFruitName(b.apple));
        })
        .filter(c => c.apple.id !== `fruit:${appleId}`) // Exclude the current apple
        .slice(0, 3)
        .map(c => ({
          appleId: c.apple.id,
          appleName: formatFruitName(c.apple),
          score: c.score,
        }));

      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${appleId} -> matched -> ${bestMatch.orange.id} CONTENT {
          score: ${bestMatch.score},
          apple_to_orange_score: ${bestMatch.breakdown.appleToOrange.score},
          orange_to_apple_score: ${bestMatch.breakdown.orangeToApple.score},
          apple_to_orange_satisfied: ${JSON.stringify(bestMatch.breakdown.appleToOrange.satisfied)},
          apple_to_orange_violated: ${JSON.stringify(bestMatch.breakdown.appleToOrange.violated)},
          orange_to_apple_satisfied: ${JSON.stringify(bestMatch.breakdown.orangeToApple.satisfied)},
          orange_to_apple_violated: ${JSON.stringify(bestMatch.breakdown.orangeToApple.violated)},
          matched_at: time::now()
        };
      `);
    }

    // Build ranked candidates for response
    const rankedForResponse = rankedCandidates.map((c, i) => ({
      rank: i + 1,
      orangeId: c.orange.id,
      orangeName: formatFruitName(c.orange),
      score: c.score,
      breakdown: {
        appleToOrange: c.breakdown.appleToOrange,
        orangeToApple: c.breakdown.orangeToApple,
      },
    }));

    // Return raw match data - API route will handle LLM announcements and Realtime broadcast
    return new Response(
      JSON.stringify({
        message: "Apple received and processed",
        apple: {
          id: `fruit:${appleId}`,
          name: apple.name,
          description: fullDescription,
          attributes: apple.attributes,
          preferences: apple.preferences,
        },
        match: bestMatch
          ? {
              orangeId: bestMatch.orange.id,
              orangeName: formatFruitName(bestMatch.orange),
              orangeDescription: bestMatch.orange.description,
              score: bestMatch.score,
              breakdown: bestMatch.breakdown,
            }
          : null,
        rankedCandidates: rankedForResponse,
        otherApplesForOrange, // For the orange's broadcast - other apples that could match them
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
