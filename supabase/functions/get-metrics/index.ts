// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { db } from "../_shared/surreal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FruitAttributes {
  size?: number | null;
  weight?: number | null;
  hasStem?: boolean | null;
  hasLeaf?: boolean | null;
  hasWorm?: boolean | null;
  shineFactor?: string | null;
  hasChemicals?: boolean | null;
}

interface FruitRecord {
  id: string;
  type: string;
  name?: string;
  attributes?: FruitAttributes;
  created_at?: string;
}

interface MatchRecord {
  id: string;
  in: string;
  out: string;
  score: number;
  matched_at?: string;
  apple_name?: string;
  orange_name?: string;
  apple_to_orange_score?: number;
  orange_to_apple_score?: number;
  apple_to_orange_satisfied?: string[];
  apple_to_orange_violated?: string[];
  orange_to_apple_satisfied?: string[];
  orange_to_apple_violated?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Count apples
    const applesResult = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM fruit WHERE type = "apple" GROUP ALL;
    `);
    const totalApples = applesResult[0]?.[0]?.count ?? 0;

    // Count oranges
    const orangesResult = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM fruit WHERE type = "orange" GROUP ALL;
    `);
    const totalOranges = orangesResult[0]?.[0]?.count ?? 0;

    // Count matches (RELATE edges)
    const matchesResult = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM matched GROUP ALL;
    `);
    const totalMatches = matchesResult[0]?.[0]?.count ?? 0;

    // Get average match score
    const avgScoreResult = await db.query<{ avg_score: number }[]>(`
      SELECT math::mean(score) as avg_score FROM matched GROUP ALL;
    `);
    const avgScore = avgScoreResult[0]?.[0]?.avg_score ?? 0;

    // Get recent matches with details including fruit names
    const recentMatchesResult = await db.query<MatchRecord[]>(`
      SELECT *, in.name as apple_name, out.name as orange_name FROM matched ORDER BY matched_at DESC LIMIT 10;
    `);
    const recentMatches = recentMatchesResult[0] || [];

    // Calculate success rate (matches with score > 0.7 considered successful)
    const highQualityMatchesResult = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM matched WHERE score > 0.7 GROUP ALL;
    `);
    const highQualityMatches = highQualityMatchesResult[0]?.[0]?.count ?? 0;
    const successRate = totalMatches > 0 ? Math.round((highQualityMatches / totalMatches) * 100) : 0;

    // Get match score distribution
    const scoreDistribution = await db.query<{ range: string; count: number }[]>(`
      SELECT 
        "0.9-1.0" as range,
        count() as count
      FROM matched 
      WHERE score >= 0.9 
      GROUP ALL;
    `);
    
    const score80Result = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM matched WHERE score >= 0.8 AND score < 0.9 GROUP ALL;
    `);
    const score70Result = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM matched WHERE score >= 0.7 AND score < 0.8 GROUP ALL;
    `);
    const scoreLowResult = await db.query<{ count: number }[]>(`
      SELECT count() as count FROM matched WHERE score < 0.7 GROUP ALL;
    `);

    // Get all fruits with their match data including attributes
    const allFruitsResult = await db.query<FruitRecord[]>(`
      SELECT id, type, name, attributes FROM fruit ORDER BY type, name;
    `);
    const allFruits = allFruitsResult[0] || [];

    // Build fruit lookup map for partner names
    const fruitMap: Record<string, FruitRecord> = {};
    for (const f of allFruits) {
      fruitMap[f.id] = f;
    }

    // Get all matches for building per-fruit breakdown
    const allMatchesResult = await db.query<MatchRecord[]>(`
      SELECT *, in.name as apple_name, out.name as orange_name FROM matched;
    `);
    const allMatches = allMatchesResult[0] || [];

    // Build per-fruit data with matches
    const fruitBreakdown = allFruits.map((fruit: FruitRecord) => {
      const isApple = fruit.type === "apple";
      
      // Find matches where this fruit is involved (check both directions)
      const matches = allMatches.filter((m: MatchRecord) => 
        m.in === fruit.id || m.out === fruit.id
      ).map((m: MatchRecord) => {
        // Determine partner based on which side this fruit is on
        const isFruitTheInNode = m.in === fruit.id;
        const partnerId = isFruitTheInNode ? m.out : m.in;
        const partner = fruitMap[partnerId];
        const partnerName = partner?.name || partnerId.split(':')[1] || 'Unknown';
        
        return {
          matchId: m.id,
          partnerId,
          partnerName,
          score: m.score,
          breakdown: {
            myPrefsScore: isApple ? m.apple_to_orange_score : m.orange_to_apple_score,
            theirPrefsScore: isApple ? m.orange_to_apple_score : m.apple_to_orange_score,
            myPrefsSatisfied: isApple ? m.apple_to_orange_satisfied : m.orange_to_apple_satisfied,
            myPrefsViolated: isApple ? m.apple_to_orange_violated : m.orange_to_apple_violated,
            theirPrefsSatisfied: isApple ? m.orange_to_apple_satisfied : m.apple_to_orange_satisfied,
            theirPrefsViolated: isApple ? m.orange_to_apple_violated : m.apple_to_orange_violated,
          },
          matchedAt: m.matched_at,
        };
      }).sort((a: { score: number }, b: { score: number }) => b.score - a.score);

      return {
        id: fruit.id,
        type: fruit.type,
        name: fruit.name || fruit.id.split(':')[1],
        attributes: fruit.attributes,
        matchCount: matches.length,
        bestMatch: matches[0] || null,
        runnerUps: matches.slice(1, 5), // Next 4 best matches (total top 5)
      };
    });

    return new Response(
      JSON.stringify({
        metrics: {
          totalApples,
          totalOranges,
          totalMatches,
          successRate,
          avgScore: Math.round(avgScore * 100) / 100,
        },
        scoreDistribution: {
          excellent: scoreDistribution[0]?.[0]?.count ?? 0,
          good: score80Result[0]?.[0]?.count ?? 0,
          fair: score70Result[0]?.[0]?.count ?? 0,
          low: scoreLowResult[0]?.[0]?.count ?? 0,
        },
        recentMatches: recentMatches.map((m: MatchRecord) => ({
          id: m.id,
          appleId: m.in,
          appleName: m.apple_name,
          orangeId: m.out,
          orangeName: m.orange_name,
          score: m.score,
          matchedAt: m.matched_at,
          breakdown: {
            appleToOrange: {
              score: m.apple_to_orange_score ?? 0,
              satisfied: m.apple_to_orange_satisfied ?? [],
              violated: m.apple_to_orange_violated ?? [],
            },
            orangeToApple: {
              score: m.orange_to_apple_score ?? 0,
              satisfied: m.orange_to_apple_satisfied ?? [],
              violated: m.orange_to_apple_violated ?? [],
            },
          },
        })),
        fruitBreakdown: {
          apples: fruitBreakdown.filter((f: { type: string }) => f.type === "apple"),
          oranges: fruitBreakdown.filter((f: { type: string }) => f.type === "orange"),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
