import type { MatchMetrics } from "./page";

// =============================================================================
// ⚠️  DISCLAIMER
// =============================================================================
// This loader is EXAMPLE SCAFFOLDING. You should:
// - Define your own data types based on your solution
// - Implement actual database queries to SurrealDB
// - Add whatever data fetching logic your dashboard needs
//
// The structure here is just one possible approach - feel free to do
// something completely different!
// =============================================================================

// =============================================================================
// TYPES (Examples - define your own!)
// =============================================================================

export interface DashboardData {
  metrics: MatchMetrics;
  // These are just example fields - add whatever your dashboard needs!
  // recentMatches: Match[];
  // analyticsData: AnalyticsData;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Server-side data loader for the dashboard page.
 *
 * ⚠️ This is placeholder code! Replace with your actual implementation.
 *
 * This function runs on the server and can:
 * - Query SurrealDB directly
 * - Call edge functions
 * - Access server-only resources
 *
 * The data shape returned here should match what YOUR dashboard needs,
 * not necessarily what's shown in this example.
 */
export async function getDashboardData(): Promise<DashboardData> {
  // Simulate network delay for loading state demo
  await new Promise((resolve) => setTimeout(resolve, 500));

  // TODO: Replace with actual database queries
  // Example SurrealDB query structure:
  //
  // const db = await getSurrealClient();
  // const [apples, oranges, matches] = await Promise.all([
  //   db.query("SELECT count() FROM apples GROUP ALL"),
  //   db.query("SELECT count() FROM oranges GROUP ALL"),
  //   db.query("SELECT count() FROM matches GROUP ALL"),
  // ]);

  const metrics: MatchMetrics = {
    totalApples: 0,
    totalOranges: 0,
    totalMatches: 0,
    successRate: 0,
  };

  return {
    metrics,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * TODO: Add your SurrealDB client initialization here
 *
 * Example:
 * ```ts
 * import Surreal from "surrealdb.js";
 *
 * export async function getSurrealClient() {
 *   const db = new Surreal();
 *   await db.connect("http://localhost:8000/rpc");
 *   await db.use({ namespace: "matchmaking", database: "main" });
 *   return db;
 * }
 * ```
 */

/**
 * TODO: Add functions to query specific data
 *
 * Example:
 * ```ts
 * export async function getRecentMatches(limit = 10) {
 *   const db = await getSurrealClient();
 *   return db.query(`
 *     SELECT * FROM matches
 *     ORDER BY created_at DESC
 *     LIMIT $limit
 *   `, { limit });
 * }
 * ```
 */

