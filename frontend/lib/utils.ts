// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generates a unique ID
 * TODO: Consider using a more robust ID generation library like nanoid
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

/**
 * Classname utility for conditional classes
 * Similar to clsx/classnames
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Delays execution for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses JSON with a fallback value
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// =============================================================================
// EFFECT UTILITIES
// =============================================================================

/**
 * TODO: Add Effect library utilities here
 *
 * Example:
 * ```ts
 * import { Effect, pipe } from "effect";
 *
 * export const fetchWithRetry = <T>(
 *   url: string,
 *   retries = 3
 * ): Effect.Effect<T, Error> =>
 *   pipe(
 *     Effect.tryPromise(() => fetch(url).then((r) => r.json())),
 *     Effect.retry({ times: retries })
 *   );
 * ```
 */

