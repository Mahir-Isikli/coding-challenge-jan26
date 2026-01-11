import { Suspense } from "react";
import { getDashboardData } from "./loader";

async function StatsContent() {
  const data = await getDashboardData();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Stats Card */}
      <div className="card p-6">
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-4">
          Overview
        </h3>
        <div className="space-y-4">
          <StatRow label="Total Apples" value={data.metrics.totalApples} />
          <StatRow label="Total Oranges" value={data.metrics.totalOranges} />
          <StatRow label="Total Matches" value={data.metrics.totalMatches} />
          <StatRow
            label="Average Score"
            value={`${(data.metrics.avgScore * 100).toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Match Quality Card */}
      <div className="card p-6">
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-4">
          Match Quality Distribution
        </h3>
        <div className="space-y-3">
          <QualityRow
            label="Excellent (90%+)"
            count={data.scoreDistribution.excellent}
            total={data.metrics.totalMatches}
            color="bg-green-500"
          />
          <QualityRow
            label="Good (75-89%)"
            count={data.scoreDistribution.good}
            total={data.metrics.totalMatches}
            color="bg-blue-500"
          />
          <QualityRow
            label="Fair (50-74%)"
            count={data.scoreDistribution.fair}
            total={data.metrics.totalMatches}
            color="bg-yellow-500"
          />
          <QualityRow
            label="Low (<50%)"
            count={data.scoreDistribution.low}
            total={data.metrics.totalMatches}
            color="bg-red-500"
          />
        </div>
      </div>

      {/* Recent Matches Card */}
      <div className="card p-6">
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-4">
          Recent Matches
        </h3>
        <div className="space-y-2">
          {data.recentMatches.length > 0 ? (
            data.recentMatches.slice(0, 8).map((match) => (
              <RecentMatch key={match.id} match={match} />
            ))
          ) : (
            <p className="text-sm text-tertiary">No matches yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-lg font-mono font-medium">{value}</span>
    </div>
  );
}

function QualityRow({
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
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-secondary">{label}</span>
        <span className="font-mono text-tertiary">{count}</span>
      </div>
      <div className="h-2 bg-[var(--color-bg-muted)] overflow-hidden rounded-sm">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function RecentMatch({
  match,
}: {
  match: { id: string; appleId: string; orangeId: string; score: number };
}) {
  const formatId = (id: string) => {
    const parts = id.split(":")[1] || id;
    const numMatch = parts.match(/_(\d+)$/);
    if (!numMatch) return "?";
    const num = numMatch[1];
    if (num.length > 6) return num.slice(-3);
    return num;
  };
  const scorePercent = Math.round(match.score * 100);
  return (
    <div className="flex items-center gap-3 text-sm py-1.5 border-b border-[var(--color-border)] last:border-0">
      <span className="flex items-center gap-1.5">
        <span>🍎</span>
        <span className="text-secondary font-mono">{formatId(match.appleId)}</span>
      </span>
      <span className="text-tertiary">×</span>
      <span className="flex items-center gap-1.5">
        <span>🍊</span>
        <span className="text-secondary font-mono">{formatId(match.orangeId)}</span>
      </span>
      <span className="ml-auto font-mono text-sm tabular-nums font-medium">
        {scorePercent}%
      </span>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card p-6">
          <div className="skeleton h-3 w-24 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="skeleton h-5 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium">Dashboard</h2>
        <p className="text-sm text-tertiary mt-1">
          Overview of matchmaking activity and statistics
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent />
      </Suspense>
    </main>
  );
}
