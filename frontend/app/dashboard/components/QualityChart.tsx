"use client";

interface QualityChartProps {
  distribution: {
    excellent: number;
    good: number;
    fair: number;
    low: number;
  };
  total: number;
}

const COLORS = {
  excellent: "#16a34a",
  good: "#3b82f6", 
  fair: "#ca8a04",
  low: "#dc2626",
};

export function QualityChart({ distribution, total }: QualityChartProps) {
  const data = [
    { name: "Excellent", range: "90%+", value: distribution.excellent, color: COLORS.excellent },
    { name: "Good", range: "75-89%", value: distribution.good, color: COLORS.good },
    { name: "Fair", range: "50-74%", value: distribution.fair, color: COLORS.fair },
    { name: "Low", range: "<50%", value: distribution.low, color: COLORS.low },
  ];

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="card p-5 h-full bg-white">
      <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-4">
        Match Quality
      </h3>
      <div className="space-y-4">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          
          return (
            <div key={item.name} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{item.name}</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">{item.range}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono tabular-nums">{item.value}</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)] w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-2 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${Math.max(barWidth, item.value > 0 ? 4 : 0)}%`,
                    backgroundColor: item.color 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
