import { Suspense } from "react";
import { getDashboardData } from "./loader";
import { ConversationPanel } from "./components/ConversationPanel";

// =============================================================================
// TYPES
// =============================================================================

export interface MatchMetrics {
  totalApples: number;
  totalOranges: number;
  totalMatches: number;
  successRate: number;
  avgScore?: number;
}

// =============================================================================
// SERVER DATA LOADING
// =============================================================================

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <>
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <MetricCard
          title="Apples"
          value={data.metrics.totalApples}
          icon="🍎"
          description="In pool"
          color="red"
        />
        <MetricCard
          title="Oranges"
          value={data.metrics.totalOranges}
          icon="🍊"
          description="In pool"
          color="orange"
        />
        <MetricCard
          title="Matches"
          value={data.metrics.totalMatches}
          icon="🍐"
          description="Perfect pears"
          color="green"
        />
        <MetricCard
          title="Success Rate"
          value={`${data.metrics.successRate}%`}
          icon="📊"
          description="High quality"
          color="blue"
        />
        <MetricCard
          title="Avg Score"
          value={`${(data.metrics.avgScore * 100).toFixed(1)}%`}
          icon="⭐"
          description="Compatibility"
          color="yellow"
        />
      </div>

      {/* Score Distribution */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-semibold">Match Quality Distribution</h3>
          <div className="space-y-3">
            <ScoreBar
              label="Excellent (90-100%)"
              count={data.scoreDistribution.excellent}
              total={data.metrics.totalMatches}
              color="bg-green-500"
            />
            <ScoreBar
              label="Good (80-90%)"
              count={data.scoreDistribution.good}
              total={data.metrics.totalMatches}
              color="bg-blue-500"
            />
            <ScoreBar
              label="Fair (70-80%)"
              count={data.scoreDistribution.fair}
              total={data.metrics.totalMatches}
              color="bg-yellow-500"
            />
            <ScoreBar
              label="Low (<70%)"
              count={data.scoreDistribution.low}
              total={data.metrics.totalMatches}
              color="bg-red-500"
            />
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 font-semibold">Recent Matches</h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {data.recentMatches.length > 0 ? (
              data.recentMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🍎</span>
                    <span className="text-xs text-muted truncate max-w-[80px]">
                      {match.appleId.split(":")[1]}
                    </span>
                    <span className="text-xs">↔</span>
                    <span className="text-sm">🍊</span>
                    <span className="text-xs text-muted truncate max-w-[80px]">
                      {match.orangeId.split(":")[1]}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      match.score >= 0.9
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                        : match.score >= 0.8
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                        : match.score >= 0.7
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                    }`}
                  >
                    {(match.score * 100).toFixed(0)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted py-8">
                No matches yet. Start a conversation!
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  description: string;
  color?: "red" | "orange" | "green" | "blue" | "yellow";
}

function MetricCard({ title, value, icon, description, color = "blue" }: MetricCardProps) {
  const colorClasses = {
    red: "border-l-red-500",
    orange: "border-l-orange-500",
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    yellow: "border-l-yellow-500",
  };

  return (
    <div className={`metric-card border-l-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <span className="text-xs uppercase tracking-wide text-muted">{title}</span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">{count}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="metric-card animate-pulse border-l-4 border-l-zinc-300">
      <div className="flex items-center justify-between">
        <div className="h-6 w-6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-3">
        <div className="h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card h-[300px] animate-pulse">
          <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="card h-[300px] animate-pulse">
          <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                🍎 Fruit Matchmaking 🍊
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-muted">
                Creating perfect pears, one match at a time
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Conversation Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Start Matching</h2>
          <ConversationPanel />
        </section>

        {/* Metrics Section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">System Metrics</h2>
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
