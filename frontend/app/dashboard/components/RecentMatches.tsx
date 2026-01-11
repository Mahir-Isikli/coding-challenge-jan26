"use client";

import { useState } from "react";

interface PreferenceSatisfaction {
  score: number;
  satisfied: string[];
  violated: string[];
}

interface MatchBreakdown {
  appleToOrange: PreferenceSatisfaction;
  orangeToApple: PreferenceSatisfaction;
}

interface Match {
  id: string;
  appleId: string;
  appleName?: string;
  orangeId: string;
  orangeName?: string;
  score: number;
  breakdown?: MatchBreakdown;
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

function formatPrefName(pref: string): string {
  return pref
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function PreferenceBreakdown({ breakdown, appleName, orangeName }: { 
  breakdown: MatchBreakdown; 
  appleName: string;
  orangeName: string;
}) {
  const appleScore = Math.round(breakdown.appleToOrange.score * 100);
  const orangeScore = Math.round(breakdown.orangeToApple.score * 100);
  
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
      {/* Apple's preferences satisfied by Orange */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            🍎 {appleName}&apos;s preferences met by {orangeName}
          </span>
          <span 
            className="text-[11px] font-mono font-medium"
            style={{ color: getScoreColor(breakdown.appleToOrange.score) }}
          >
            {appleScore}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {breakdown.appleToOrange.satisfied.map((pref) => (
            <span
              key={pref}
              className="px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-700 border border-green-200"
            >
              ✓ {formatPrefName(pref)}
            </span>
          ))}
          {breakdown.appleToOrange.violated.map((pref) => (
            <span
              key={pref}
              className="px-2 py-0.5 text-[10px] rounded-full bg-red-50 text-red-700 border border-red-200"
            >
              ✗ {formatPrefName(pref.split(" (")[0])}
            </span>
          ))}
          {breakdown.appleToOrange.satisfied.length === 0 && breakdown.appleToOrange.violated.length === 0 && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] italic">No specific preferences</span>
          )}
        </div>
      </div>
      
      {/* Orange's preferences satisfied by Apple */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            🍊 {orangeName}&apos;s preferences met by {appleName}
          </span>
          <span 
            className="text-[11px] font-mono font-medium"
            style={{ color: getScoreColor(breakdown.orangeToApple.score) }}
          >
            {orangeScore}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {breakdown.orangeToApple.satisfied.map((pref) => (
            <span
              key={pref}
              className="px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-700 border border-green-200"
            >
              ✓ {formatPrefName(pref)}
            </span>
          ))}
          {breakdown.orangeToApple.violated.map((pref) => (
            <span
              key={pref}
              className="px-2 py-0.5 text-[10px] rounded-full bg-red-50 text-red-700 border border-red-200"
            >
              ✗ {formatPrefName(pref.split(" (")[0])}
            </span>
          ))}
          {breakdown.orangeToApple.satisfied.length === 0 && breakdown.orangeToApple.violated.length === 0 && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] italic">No specific preferences</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="card p-5 h-full bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          Recent Matches
        </h3>
        {matches.length > 0 && (
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            Click to see preference breakdown
          </span>
        )}
      </div>
      {matches.length > 0 ? (
        <div className="space-y-2">
          {matches.slice(0, 6).map((match) => {
            const scorePercent = Math.round(match.score * 100);
            const scoreColor = getScoreColor(match.score);
            const isExpanded = expandedId === match.id;
            const appleName = formatDisplay(match.appleId, match.appleName);
            const orangeName = formatDisplay(match.orangeId, match.orangeName);

            return (
              <div 
                key={match.id} 
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isExpanded 
                    ? "border-[var(--color-border-active)] bg-[var(--color-bg-subtle)]" 
                    : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }`}
                onClick={() => setExpandedId(isExpanded ? null : match.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span>🍎</span>
                      <span className="text-[13px] text-[var(--color-text)] font-medium">{appleName}</span>
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">↔</span>
                    <span className="flex items-center gap-1.5">
                      <span>🍊</span>
                      <span className="text-[13px] text-[var(--color-text)] font-medium">{orangeName}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${scorePercent}%`, backgroundColor: scoreColor }}
                      />
                    </div>
                    <span
                      className="text-[13px] font-mono font-semibold tabular-nums w-12 text-right"
                      style={{ color: scoreColor }}
                    >
                      {scorePercent}%
                    </span>
                  </div>
                </div>
                
                {isExpanded && match.breakdown && (
                  <PreferenceBreakdown 
                    breakdown={match.breakdown} 
                    appleName={appleName}
                    orangeName={orangeName}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-[13px] text-[var(--color-text-tertiary)]">
          No matches yet
        </div>
      )}
    </div>
  );
}
