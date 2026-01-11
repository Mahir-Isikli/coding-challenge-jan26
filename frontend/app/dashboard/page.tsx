import { Suspense } from "react";
import { getDashboardData } from "./loader";
import { ConversationPanel } from "./components/ConversationPanel";

async function Sidebar() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      {/* How it works */}
      <div>
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-3">How it works</h3>
        <div className="space-y-2 text-sm text-secondary">
          <p>1. Add a fruit (apple or orange)</p>
          <p>2. System generates attributes & preferences</p>
          <p>3. Text → 1536-dim embedding (OpenAI)</p>
          <p>4. Cosine similarity match (SurrealDB)</p>
          <p>5. Match announcement (Claude)</p>
        </div>
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      {/* Stats */}
      <div>
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-3">Stats</h3>
        <div className="space-y-2">
          <StatRow label="Apples" value={data.metrics.totalApples} />
          <StatRow label="Oranges" value={data.metrics.totalOranges} />
          <StatRow label="Matches" value={data.metrics.totalMatches} />
          <StatRow label="Avg score" value={`${(data.metrics.avgScore * 100).toFixed(0)}%`} />
        </div>
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      {/* Quality */}
      <div>
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-3">Match quality</h3>
        <div className="space-y-2">
          <QualityRow label="Excellent" count={data.scoreDistribution.excellent} total={data.metrics.totalMatches} />
          <QualityRow label="Good" count={data.scoreDistribution.good} total={data.metrics.totalMatches} />
          <QualityRow label="Fair" count={data.scoreDistribution.fair} total={data.metrics.totalMatches} />
          <QualityRow label="Low" count={data.scoreDistribution.low} total={data.metrics.totalMatches} />
        </div>
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      {/* Recent */}
      <div>
        <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-3">Recent matches</h3>
        <div className="space-y-1.5">
          {data.recentMatches.length > 0 ? (
            data.recentMatches.slice(0, 5).map((match) => (
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
    <div className="flex justify-between text-sm">
      <span className="text-secondary">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function QualityRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-secondary w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[var(--color-text)] rounded-full transition-all" 
          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} 
        />
      </div>
      <span className="font-mono text-tertiary w-4 text-right">{count}</span>
    </div>
  );
}

function RecentMatch({ match }: { match: { id: string; appleId: string; orangeId: string; score: number } }) {
  const formatId = (id: string) => {
    const name = id.split(":")[1] || id;
    return name.slice(0, 8);
  };
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-tertiary">
        {formatId(match.appleId)} → {formatId(match.orangeId)}
      </span>
      <span className="font-mono">{(match.score * 100).toFixed(0)}%</span>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-3 w-20 mb-3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-4 w-full" />)}
        </div>
      </div>
      <div className="h-px bg-[var(--color-border)]" />
      <div>
        <div className="skeleton h-3 w-12 mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-4 w-full" />)}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="border-b sticky top-0 bg-[var(--color-bg)] z-50">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <h1 className="text-sm font-medium">Fruit Matchmaking</h1>
          <span className="badge badge-live">Live</span>
        </div>
      </header>

      {/* Main - two column layout */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-8">
          {/* Left: Conversation (2/3) */}
          <div className="flex-1 min-w-0">
            <ConversationPanel />
          </div>

          {/* Right: Sidebar (1/3) */}
          <div className="w-72 flex-shrink-0">
            <Suspense fallback={<SidebarSkeleton />}>
              <Sidebar />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
