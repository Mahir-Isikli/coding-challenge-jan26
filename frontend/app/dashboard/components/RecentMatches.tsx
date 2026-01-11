interface Match {
  id: string;
  appleId: string;
  orangeId: string;
  score: number;
}

interface RecentMatchesProps {
  matches: Match[];
}

function formatId(id: string): string {
  const parts = id.split(":")[1] || id;
  const numMatch = parts.match(/_(\d+)$/);
  if (!numMatch) return "?";
  const num = numMatch[1];
  if (num.length > 6) return num.slice(-3);
  return num;
}

function getScoreColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.75) return "#3b82f6";
  if (score >= 0.5) return "#ca8a04";
  return "#dc2626";
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          Recent Matches
        </h3>
        {matches.length > 0 && (
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            Last {Math.min(matches.length, 8)}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {matches.length > 0 ? (
          matches.slice(0, 8).map((match) => {
            const scorePercent = Math.round(match.score * 100);
            const scoreColor = getScoreColor(match.score);
            
            return (
              <div
                key={match.id}
                className="flex items-center gap-3 p-2.5 rounded-md bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span>🍎</span>
                    <span className="font-mono text-[13px] text-[var(--color-text)]">{formatId(match.appleId)}</span>
                  </span>
                  <span className="text-[var(--color-text-tertiary)]">→</span>
                  <span className="flex items-center gap-1.5">
                    <span>🍊</span>
                    <span className="font-mono text-[13px] text-[var(--color-text)]">{formatId(match.orangeId)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full"
                      style={{ width: `${scorePercent}%`, backgroundColor: scoreColor }}
                    />
                  </div>
                  <span 
                    className="text-[12px] font-mono font-medium tabular-nums w-10 text-right"
                    style={{ color: scoreColor }}
                  >
                    {scorePercent}%
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-12 text-[13px] text-[var(--color-text-tertiary)]">
            No matches yet
          </div>
        )}
      </div>
    </div>
  );
}
