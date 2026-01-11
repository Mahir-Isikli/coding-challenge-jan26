import { Effect } from "effect";
import { fetchJson, FetchError, ApiError } from "./utils";

// Edge function base URL - hosted Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";

export interface FruitMatch {
  orangeId?: string;
  appleId?: string;
  score: number;
  announcement: string;
}

export interface IncomingFruitResponse {
  message: string;
  apple?: {
    id: string;
    description: string;
  };
  orange?: {
    id: string;
    description: string;
  };
  match: FruitMatch | null;
}

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

interface FruitBreakdownItem {
  id: string;
  type: string;
  name: string;
  matchCount: number;
  bestMatch: FruitMatchInfo | null;
  runnerUps: FruitMatchInfo[];
}

export interface MetricsResponse {
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

export interface SurrealQueryResponse<T> {
  result: T;
  status: string;
  time: string;
}

export async function callIncomingApple(): Promise<IncomingFruitResponse> {
  const url = `${SUPABASE_URL}/functions/v1/get-incoming-apple`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to call get-incoming-apple: ${response.statusText}`);
  }

  return response.json();
}

export async function callIncomingOrange(): Promise<IncomingFruitResponse> {
  const url = `${SUPABASE_URL}/functions/v1/get-incoming-orange`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to call get-incoming-orange: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const url = `${SUPABASE_URL}/functions/v1/get-metrics`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`);
  }

  return response.json();
}

// Effect-based versions for more robust error handling
export const callIncomingAppleEffect = (): Effect.Effect<IncomingFruitResponse, FetchError | ApiError> =>
  fetchJson<IncomingFruitResponse>(`${SUPABASE_URL}/functions/v1/get-incoming-apple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const callIncomingOrangeEffect = (): Effect.Effect<IncomingFruitResponse, FetchError | ApiError> =>
  fetchJson<IncomingFruitResponse>(`${SUPABASE_URL}/functions/v1/get-incoming-orange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const fetchMetricsEffect = (): Effect.Effect<MetricsResponse, FetchError | ApiError> =>
  fetchJson<MetricsResponse>(`${SUPABASE_URL}/functions/v1/get-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
