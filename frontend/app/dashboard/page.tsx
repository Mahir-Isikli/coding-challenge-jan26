import { Suspense } from "react";
import { getDashboardData } from "./loader";
import { RecentMatches } from "./components/RecentMatches";
import { FruitBreakdown } from "./components/FruitBreakdown";

async function StatsContent() {
  const data = await getDashboardData();
  const { excellent, good } = data.scoreDistribution;

  return (
    <div className="space-y-5">
      {/* Hero stats row - all in one row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          tooltip="Matches are created when you add a new Apple or Orange. Each new fruit is matched with the best compatible partner from the opposite type."
        />
        <HeroStat 
          label="Avg Score" 
          value={`${(data.metrics.avgScore * 100).toFixed(0)}%`} 
          highlight={data.metrics.avgScore >= 0.7}
          tooltip="Average of all match scores. Each match score = (Apple's preferences met + Orange's preferences met) / 2"
        />
        <HeroStat 
          label="Excellent" 
          value={excellent}
          subtitle="90%+"
          highlight={excellent > 0}
          color="#16a34a"
        />
        <HeroStat 
          label="Good" 
          value={good}
          subtitle="75-89%"
          color="#3b82f6"
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-5">
        <RecentMatches matches={data.recentMatches} />
      </div>

      {/* Per-fruit breakdown */}
      <div className="mt-5">
        <FruitBreakdown 
          apples={data.fruitBreakdown.apples} 
          oranges={data.fruitBreakdown.oranges} 
        />
      </div>
    </div>
  );
}

function HeroStat({ 
  label, 
  value, 
  icon,
  subtitle,
  highlight,
  tooltip,
  color
}: { 
  label: string; 
  value: string | number; 
  icon?: string;
  subtitle?: string;
  highlight?: boolean;
  tooltip?: string;
  color?: string;
}) {
  return (
    <div className="card p-4 bg-white group relative">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-sm">{icon}</span>}
        {color && !icon && (
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          {label}
        </span>
        {subtitle && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{subtitle}</span>
        )}
        {tooltip && (
          <span className="text-[10px] text-gray-400 cursor-help">ⓘ</span>
        )}
      </div>
      <div 
        className={`text-2xl font-semibold tabular-nums ${highlight && !color ? 'text-[var(--color-success)]' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64 text-center leading-relaxed shadow-lg">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
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
