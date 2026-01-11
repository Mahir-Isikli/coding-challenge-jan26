// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { db } from "../_shared/surreal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FruitRecord {
  id: string;
  type: string;
  created_at?: string;
}

interface MatchRecord {
  id: string;
  in: string;
  out: string;
  score: number;
  matched_at?: string;
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

    // Get recent matches with details
    const recentMatchesResult = await db.query<MatchRecord[]>(`
      SELECT *, <-fruit as apple, ->fruit as orange FROM matched ORDER BY matched_at DESC LIMIT 10;
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
          orangeId: m.out,
          score: m.score,
          matchedAt: m.matched_at,
        })),
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
