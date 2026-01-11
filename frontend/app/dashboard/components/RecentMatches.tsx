import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Match {
  id: string;
  appleId: string;
  appleName?: string;
  orangeId: string;
  orangeName?: string;
  score: number;
}

interface RecentMatchesProps {
  matches: Match[];
}

function formatDisplay(id: string, name?: string): string {
  if (name) return name;
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
      {matches.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[11px] text-[var(--color-text-tertiary)] font-medium h-8">Apple</TableHead>
              <TableHead className="text-[11px] text-[var(--color-text-tertiary)] font-medium h-8">Orange</TableHead>
              <TableHead className="text-[11px] text-[var(--color-text-tertiary)] font-medium h-8 text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.slice(0, 8).map((match) => {
              const scorePercent = Math.round(match.score * 100);
              const scoreColor = getScoreColor(match.score);

              return (
                <TableRow key={match.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)]">
                  <TableCell className="py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span>🍎</span>
                      <span className="text-[13px] text-[var(--color-text)]">{formatDisplay(match.appleId, match.appleName)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span>🍊</span>
                      <span className="text-[13px] text-[var(--color-text)]">{formatDisplay(match.orangeId, match.orangeName)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="flex items-center justify-center py-12 text-[13px] text-[var(--color-text-tertiary)]">
          No matches yet
        </div>
      )}
    </div>
  );
}
