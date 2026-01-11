import { fetchMetrics } from "@/lib/api";

interface PreferenceSatisfaction {
  score: number;
  satisfied: string[];
  violated: string[];
}

interface MatchBreakdown {
  appleToOrange: PreferenceSatisfaction;
  orangeToApple: PreferenceSatisfaction;
}

interface FruitMatchInfo {
  matchId: string;
  partnerId: string;
  partnerName?: string;
  score: number;
  breakdown: {
    myPrefsScore?: number;
    theirPrefsScore?: number;
    myPrefsSatisfied?: string[];
    myPrefsViolated?: string[];
    theirPrefsSatisfied?: string[];
    theirPrefsViolated?: string[];
  };
  matchedAt?: string;
}

interface FruitAttributes {
  size?: number | null;
  weight?: number | null;
  hasStem?: boolean | null;
  hasLeaf?: boolean | null;
  hasWorm?: boolean | null;
  shineFactor?: string | null;
  hasChemicals?: boolean | null;
}

interface FruitPreferences {
  size?: { min?: number; max?: number } | null;
  weight?: { min?: number; max?: number } | null;
  hasStem?: boolean | null;
  hasLeaf?: boolean | null;
  hasWorm?: boolean | null;
  shineFactor?: string | string[] | null;
  hasChemicals?: boolean | null;
}

export interface FruitBreakdownItem {
  id: string;
  type: string;
  name: string;
  attributes?: FruitAttributes;
  preferences?: FruitPreferences;
  matchCount: number;
  bestMatch: FruitMatchInfo | null;
  runnerUps: FruitMatchInfo[];
}

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
    breakdown: MatchBreakdown;
  }>;
  fruitBreakdown: {
    apples: FruitBreakdownItem[];
    oranges: FruitBreakdownItem[];
  };
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
      fruitBreakdown: data.fruitBreakdown,
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
      fruitBreakdown: {
        apples: [],
        oranges: [],
      },
    };
  }
}
