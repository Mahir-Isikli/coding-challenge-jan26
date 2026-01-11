// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences, type Fruit } from "../_shared/generateFruit.ts";
import { db } from "../_shared/surreal.ts";
// Embeddings removed - using 100% preference-based matching

/**
 * Get Incoming Orange Edge Function
 *
 * PREFERENCE-BASED MATCHING (Bidirectional):
 * Calculates how well attributes satisfy preferences in BOTH directions:
 * 1. Does the apple satisfy the orange's preferences?
 * 2. Does the orange satisfy the apple's preferences?
 *
 * Task Flow:
 * 1. Generate a new orange instance
 * 2. Capture the orange's communication (attributes and preferences)
 * 3. Store the new orange in SurrealDB
 * 4. Match based on preference satisfaction (100% preference-based)
 * 5. Create RELATE edge for the match
 * 6. Return data for LLM announcements
 */

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
 * otherwise create a friendly format like "Apple #24" from the ID
 */
function formatFruitName(fruit: FruitRecord): string {
  if (fruit.name) return fruit.name;
  
  // Extract number from ID like "fruit:apple_24" -> "Apple #24"
  const match = fruit.id.match(/fruit:(apple|orange)_(\d+)/);
  if (match) {
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${type} #${match[2]}`;
  }
  return fruit.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new orange instance with unique name
    const orange = await generateOrange(db);

    // Step 2: Capture the orange's communication
    const orangeAttrs = communicateAttributes(orange);
    const orangePrefs = communicatePreferences(orange);
    const fullDescription = `${orangeAttrs}\n\n${orangePrefs}`;

    // Step 3: Store the new orange in SurrealDB (no embeddings needed)
    const orangeId = `orange_${Date.now()}`;
    await db.query<FruitRecord[]>(`
      CREATE fruit:${orangeId} CONTENT {
        type: "orange",
        name: ${JSON.stringify(orange.name)},
        attributes: ${JSON.stringify(orange.attributes)},
        preferences: ${JSON.stringify(orange.preferences)},
        description: ${JSON.stringify(fullDescription)},
        created_at: time::now()
      };
    `);

    // Step 4: PREFERENCE-BASED MATCHING (100% preference satisfaction)
    
    // Get all apples and their existing match counts for fair distribution
    const apples = await db.query<FruitRecord[]>(`
      SELECT * FROM fruit WHERE type = "apple";
    `);
    const appleList = apples[0] || [];

    // Get match counts for fair distribution tie-breaking
    const matchCountsResult = await db.query<{ id: string; count: number }[]>(`
      SELECT in as id, count() as count FROM matched GROUP BY in;
    `);
    const matchCounts: Record<string, number> = {};
    for (const row of matchCountsResult[0] || []) {
      matchCounts[row.id] = row.count;
    }
    const getMatchCount = (id: string) => matchCounts[id] || 0;

    // Calculate scores for each apple
    interface MatchCandidate {
      apple: FruitRecord;
      score: number;
      breakdown: {
        orangeToApple: { score: number; satisfied: string[]; violated: string[] };
        appleToOrange: { score: number; satisfied: string[]; violated: string[] };
      };
    }
    
    let bestMatch: MatchCandidate | null = null;
    const candidates: MatchCandidate[] = [];

    for (const apple of appleList) {
      // PREFERENCE SATISFACTION (Bidirectional)
      // 1. Does the apple satisfy the orange's preferences?
      const orangeToApple = calculatePreferenceSatisfaction(apple.attributes, orange.preferences);
      // 2. Does the orange satisfy the apple's preferences?
      const appleToOrange = calculatePreferenceSatisfaction(orange.attributes, apple.preferences);
      
      // Combined preference score (average of both directions) - this IS the final score
      const finalScore = (orangeToApple.score + appleToOrange.score) / 2;

      const candidate: MatchCandidate = {
        apple,
        score: finalScore,
        breakdown: {
          orangeToApple,
          appleToOrange,
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
        const countA = getMatchCount(a.apple.id);
        const countB = getMatchCount(b.apple.id);
        if (countA !== countB) return countA - countB;
        // Tertiary: name alphabetically for deterministic tie-breaking
        const nameA = formatFruitName(a.apple);
        const nameB = formatFruitName(b.apple);
        return nameA.localeCompare(nameB);
      })
      .slice(0, 5);
    
    bestMatch = rankedCandidates[0] || null;

    console.log("[Match]", bestMatch ? {
      appleId: bestMatch.apple.id,
      finalScore: bestMatch.score.toFixed(3),
      preferenceDetails: {
        orangeToApple: bestMatch.breakdown.orangeToApple,
        appleToOrange: bestMatch.breakdown.appleToOrange,
      },
      rankedCount: rankedCandidates.length,
    } : "No match found");

    // Step 5: Calculate "other oranges" for the matched apple (for their broadcast)
    // This shows the apple what other oranges could also be a good match for them
    let otherOrangesForApple: { orangeId: string; orangeName: string; score: number }[] = [];
    
    if (bestMatch) {
      // Get all oranges to rank from the matched apple's perspective
      const allOranges = await db.query<FruitRecord[]>(`
        SELECT * FROM fruit WHERE type = "orange";
      `);
      const orangeList = allOranges[0] || [];
      
      // Get orange match counts for fair distribution
      const orangeMatchCountsResult = await db.query<{ id: string; count: number }[]>(`
        SELECT out as id, count() as count FROM matched GROUP BY out;
      `);
      const orangeMatchCounts: Record<string, number> = {};
      for (const row of orangeMatchCountsResult[0] || []) {
        orangeMatchCounts[row.id] = row.count;
      }
      const getOrangeMatchCount = (id: string) => orangeMatchCounts[id] || 0;

      // Calculate scores from the apple's perspective
      const orangeScores = orangeList.map(orangeCandidate => {
        const appleToOrange = calculatePreferenceSatisfaction(orangeCandidate.attributes, bestMatch.apple.preferences);
        const orangeToApple = calculatePreferenceSatisfaction(bestMatch.apple.attributes, orangeCandidate.preferences);
        const score = (appleToOrange.score + orangeToApple.score) / 2;
        return { orange: orangeCandidate, score };
      });

      // Sort and get top alternatives (excluding the current orange which is the best match)
      otherOrangesForApple = orangeScores
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const countA = getOrangeMatchCount(a.orange.id);
          const countB = getOrangeMatchCount(b.orange.id);
          if (countA !== countB) return countA - countB;
          return formatFruitName(a.orange).localeCompare(formatFruitName(b.orange));
        })
        .filter(c => c.orange.id !== `fruit:${orangeId}`) // Exclude the current orange
        .slice(0, 3)
        .map(c => ({
          orangeId: c.orange.id,
          orangeName: formatFruitName(c.orange),
          score: c.score,
        }));

      // Step 6: Create RELATE edge for the match
      await db.query(`
        RELATE fruit:${orangeId} -> matched -> ${bestMatch.apple.id} CONTENT {
          score: ${bestMatch.score},
          orange_to_apple_score: ${bestMatch.breakdown.orangeToApple.score},
          apple_to_orange_score: ${bestMatch.breakdown.appleToOrange.score},
          orange_to_apple_satisfied: ${JSON.stringify(bestMatch.breakdown.orangeToApple.satisfied)},
          orange_to_apple_violated: ${JSON.stringify(bestMatch.breakdown.orangeToApple.violated)},
          apple_to_orange_satisfied: ${JSON.stringify(bestMatch.breakdown.appleToOrange.satisfied)},
          apple_to_orange_violated: ${JSON.stringify(bestMatch.breakdown.appleToOrange.violated)},
          matched_at: time::now()
        };
      `);
    }

    // Build ranked candidates for response
    const rankedForResponse = rankedCandidates.map((c, i) => ({
      rank: i + 1,
      appleId: c.apple.id,
      appleName: formatFruitName(c.apple),
      score: c.score,
      breakdown: {
        orangeToApple: c.breakdown.orangeToApple,
        appleToOrange: c.breakdown.appleToOrange,
      },
    }));

    // Return raw match data - API route will handle LLM announcements and Realtime broadcast
    return new Response(
      JSON.stringify({
        message: "Orange received and processed",
        orange: {
          id: `fruit:${orangeId}`,
          name: orange.name,
          description: fullDescription,
          attributes: orange.attributes,
          preferences: orange.preferences,
        },
        match: bestMatch
          ? {
              appleId: bestMatch.apple.id,
              appleName: formatFruitName(bestMatch.apple),
              appleDescription: bestMatch.apple.description,
              score: bestMatch.score,
              breakdown: bestMatch.breakdown,
            }
          : null,
        rankedCandidates: rankedForResponse,
        otherOrangesForApple, // For the apple's broadcast - other oranges that could match them
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
