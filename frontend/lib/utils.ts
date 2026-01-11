import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Effect, pipe, Schedule, Duration } from "effect";

// =============================================================================
// SHADCN UTILITY
// =============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// EFFECT - PRACTICAL UTILITIES
// =============================================================================

export class FetchError {
  readonly _tag = "FetchError";
  constructor(
    readonly url: string,
    readonly message: string
  ) {}
}

export class ApiError {
  readonly _tag = "ApiError";
  constructor(
    readonly status: number,
    readonly message: string
  ) {}
}

export const fetchJson = <T>(
  url: string,
  options?: RequestInit
): Effect.Effect<T, FetchError | ApiError> =>
  pipe(
    Effect.tryPromise({
      try: () => fetch(url, options),
      catch: (error) =>
        new FetchError(
          url,
          error instanceof Error ? error.message : "Network error"
        ),
    }),
    Effect.flatMap((response): Effect.Effect<T, FetchError | ApiError> => {
      if (response.ok) {
        return Effect.tryPromise({
          try: () => response.json() as Promise<T>,
          catch: () => new FetchError(url, "Failed to parse JSON"),
        });
      }
      return Effect.fail(new ApiError(response.status, response.statusText));
    })
  );

export const fetchJsonWithRetry = <T>(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Effect.Effect<T, FetchError | ApiError> => {
  const schedule = Schedule.exponential("100 millis").pipe(
    Schedule.compose(Schedule.recurs(maxRetries))
  );
  return Effect.retry(fetchJson<T>(url, options), schedule);
};

export const fetchJsonWithTimeout = <T>(
  url: string,
  options?: RequestInit,
  timeoutMs = 5000
): Effect.Effect<T, FetchError | ApiError> =>
  pipe(
    fetchJson<T>(url, options),
    Effect.timeoutFail({
      duration: Duration.millis(timeoutMs),
      onTimeout: () => new FetchError(url, "Request timed out"),
    })
  );

export const runEffect = <T, E>(effect: Effect.Effect<T, E>): Promise<T> =>
  Effect.runPromise(effect);

export const runEffectOr = <T, E>(
  effect: Effect.Effect<T, E>,
  fallback: T
): Promise<T> =>
  Effect.runPromise(
    pipe(
      effect,
      Effect.catchAll(() => Effect.succeed(fallback))
    )
  );
