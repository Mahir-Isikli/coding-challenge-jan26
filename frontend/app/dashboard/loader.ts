import { fetchMetrics } from "@/lib/api";

export interface DashboardData {
  metrics: {
    totalApples: number;
    totalOranges: number;
    totalMatches: number;
    successRate: number;
    avgScore: number;
  };
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    low: number;
  };
  recentMatches: Array<{
    id: string;
    appleId: string;
    appleName?: string;
    orangeId: string;
    orangeName?: string;
    score: number;
    matchedAt: string;
  }>;
}

/**
 * Server-side data loader for the dashboard page.
 * Fetches metrics from SurrealDB via edge function.
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const data = await fetchMetrics();
    return {
      metrics: data.metrics,
      scoreDistribution: data.scoreDistribution,
      recentMatches: data.recentMatches,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    // Return default values on error
    return {
      metrics: {
        totalApples: 0,
        totalOranges: 0,
        totalMatches: 0,
        successRate: 0,
        avgScore: 0,
      },
      scoreDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        low: 0,
      },
      recentMatches: [],
    };
  }
}
