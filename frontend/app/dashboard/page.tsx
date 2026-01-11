import { Suspense } from "react";
import { getDashboardData } from "./loader";
import { QualityChart } from "./components/QualityChart";
import { RecentMatches } from "./components/RecentMatches";

async function StatsContent() {
  const data = await getDashboardData();

  return (
    <div className="space-y-5">
      {/* Hero stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroStat 
          label="Apples" 
          value={data.metrics.totalApples} 
          icon="🍎" 
        />
        <HeroStat 
          label="Oranges" 
          value={data.metrics.totalOranges} 
          icon="🍊" 
        />
        <HeroStat 
          label="Matches" 
          value={data.metrics.totalMatches} 
          icon="💑" 
        />
        <HeroStat 
          label="Avg Score" 
          value={`${(data.metrics.avgScore * 100).toFixed(0)}%`} 
          highlight={data.metrics.avgScore >= 0.7}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <QualityChart distribution={data.scoreDistribution} total={data.metrics.totalMatches} />
        </div>
        <div className="lg:col-span-3">
          <RecentMatches matches={data.recentMatches} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ 
  label, 
  value, 
  icon,
  highlight 
}: { 
  label: string; 
  value: string | number; 
  icon?: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-4 bg-white">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${highlight ? 'text-[var(--color-success)]' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="skeleton h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 card p-5">
          <div className="skeleton h-3 w-24 mb-4" />
          <div className="skeleton h-[200px] w-full" />
        </div>
        <div className="lg:col-span-3 card p-5">
          <div className="skeleton h-3 w-28 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="skeleton h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-medium">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
          Matchmaking activity and statistics
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent />
      </Suspense>
    </main>
  );
}
