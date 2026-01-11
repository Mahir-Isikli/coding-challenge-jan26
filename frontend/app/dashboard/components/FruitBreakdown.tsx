"use client";

import { useState } from "react";
import type { FruitBreakdownItem } from "../loader";

interface FruitBreakdownProps {
  apples: FruitBreakdownItem[];
  oranges: FruitBreakdownItem[];
}

function getScoreColor(score: number): string {
  if (score >= 0.9) return "#16a34a";
  if (score >= 0.75) return "#3b82f6";
  if (score >= 0.5) return "#ca8a04";
  return "#dc2626";
}

function formatPrefName(pref: string): string {
  const name = pref.split(" (")[0];
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatAttributes(attributes?: FruitBreakdownItem['attributes']): string[] {
  if (!attributes) return [];
  const parts: string[] = [];
  
  if (attributes.size) parts.push(`size ${attributes.size}`);
  if (attributes.weight) parts.push(`${attributes.weight}g`);
  if (attributes.shineFactor) parts.push(attributes.shineFactor);
  if (attributes.hasStem) parts.push('stem');
  if (attributes.hasLeaf) parts.push('leaf');
  if (attributes.hasWorm) parts.push('worm');
  if (attributes.hasChemicals === false) parts.push('organic');
  if (attributes.hasChemicals === true) parts.push('chemicals');
  
  return parts;
}

function formatPreferences(preferences?: FruitBreakdownItem['preferences']): string[] {
  if (!preferences) return [];
  const parts: string[] = [];
  
  if (preferences.size) {
    const { min, max } = preferences.size;
    if (min && max) parts.push(`size ${min}-${max}`);
    else if (min) parts.push(`size ≥${min}`);
    else if (max) parts.push(`size ≤${max}`);
  }
  if (preferences.weight) {
    const { min, max } = preferences.weight;
    if (min && max) parts.push(`${min}-${max}g`);
    else if (min) parts.push(`≥${min}g`);
    else if (max) parts.push(`≤${max}g`);
  }
  if (preferences.shineFactor) {
    const shine = Array.isArray(preferences.shineFactor) 
      ? preferences.shineFactor.join('/') 
      : preferences.shineFactor;
    parts.push(shine);
  }
  if (preferences.hasStem === true) parts.push('stem');
  if (preferences.hasStem === false) parts.push('no stem');
  if (preferences.hasLeaf === true) parts.push('leaf');
  if (preferences.hasLeaf === false) parts.push('no leaf');
  if (preferences.hasWorm === false) parts.push('no worm');
  if (preferences.hasChemicals === false) parts.push('organic');
  
  return parts;
}

function InlineInfo({ attributes, preferences }: { 
  attributes?: FruitBreakdownItem['attributes'];
  preferences?: FruitBreakdownItem['preferences'];
}) {
  const attrParts = formatAttributes(attributes);
  const prefParts = formatPreferences(preferences);
  
  if (attrParts.length === 0 && prefParts.length === 0) return null;
  
  return (
    <div className="flex items-center gap-3 ml-2 text-[10px] text-[var(--color-text-tertiary)] overflow-hidden">
      {attrParts.length > 0 && (
        <span className="truncate">
          <span className="text-[var(--color-text-secondary)]">Has:</span> {attrParts.join(', ')}
        </span>
      )}
      {prefParts.length > 0 && (
        <span className="truncate">
          <span className="text-[var(--color-text-secondary)]">Wants:</span> {prefParts.join(', ')}
        </span>
      )}
    </div>
  );
}

function FruitCard({ fruit }: { fruit: FruitBreakdownItem }) {
  const [expanded, setExpanded] = useState(false);
  const isApple = fruit.type === "apple";
  const emoji = isApple ? "🍎" : "🍊";
  const partnerEmoji = isApple ? "🍊" : "🍎";

  return (
    <div
      className={`p-3 rounded-lg border transition-all cursor-pointer ${
        expanded
          ? "border-[var(--color-border-active)] bg-[var(--color-bg-subtle)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">{emoji}</span>
          <span className="text-[13px] font-medium text-[var(--color-text)] whitespace-nowrap">
            {fruit.name}
          </span>
          <InlineInfo attributes={fruit.attributes} preferences={fruit.preferences} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fruit.matchCount > 0 ? (
            <>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {fruit.matchCount} match{fruit.matchCount !== 1 ? "es" : ""}
              </span>
              {fruit.bestMatch && (
                <span
                  className="text-[12px] font-mono font-semibold"
                  style={{ color: getScoreColor(fruit.bestMatch.score) }}
                >
                  {Math.round(fruit.bestMatch.score * 100)}%
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-[var(--color-text-tertiary)] italic">
              No matches yet
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && fruit.bestMatch && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
          {/* All Matches (Top 5) */}
          <div>
            <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2">
              Top Matches
            </div>
            <div className="space-y-1.5">
              {/* Best match */}
              <div className="flex items-center justify-between p-2 rounded bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-green-600 w-4">#1</span>
                  <span>{partnerEmoji}</span>
                  <span className="text-[13px] font-medium text-green-800">
                    {fruit.bestMatch.partnerName || "Unknown"}
                  </span>
                </div>
                <span
                  className="text-[13px] font-mono font-semibold"
                  style={{ color: getScoreColor(fruit.bestMatch.score) }}
                >
                  {Math.round(fruit.bestMatch.score * 100)}%
                </span>
              </div>

              {/* Runner-ups */}
              {fruit.runnerUps.map((match, idx) => (
                <div
                  key={match.matchId || idx}
                  className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-muted)] border border-[var(--color-border)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-gray-400 w-4">#{idx + 2}</span>
                    <span className="text-sm">{partnerEmoji}</span>
                    <span className="text-[12px] text-[var(--color-text-secondary)]">
                      {match.partnerName || "Unknown"}
                    </span>
                  </div>
                  <span
                    className="text-[12px] font-mono"
                    style={{ color: getScoreColor(match.score) }}
                  >
                    {Math.round(match.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preference breakdown for best match */}
          {fruit.bestMatch.breakdown && (
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2">
                Best Match Preferences
              </div>
              <div className="space-y-2">
                {/* My prefs satisfied */}
                {fruit.bestMatch.breakdown.myPrefsSatisfied &&
                  fruit.bestMatch.breakdown.myPrefsSatisfied.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fruit.bestMatch.breakdown.myPrefsSatisfied.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-700 border border-green-200"
                        >
                          ✓ {formatPrefName(p)}
                        </span>
                      ))}
                    </div>
                  )}
                {/* My prefs violated */}
                {fruit.bestMatch.breakdown.myPrefsViolated &&
                  fruit.bestMatch.breakdown.myPrefsViolated.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fruit.bestMatch.breakdown.myPrefsViolated.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 text-[10px] rounded-full bg-red-50 text-red-700 border border-red-200"
                        >
                          ✗ {formatPrefName(p)}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FruitBreakdown({ apples, oranges }: FruitBreakdownProps) {
  const [activeTab, setActiveTab] = useState<"apples" | "oranges">("apples");

  const fruits = activeTab === "apples" ? apples : oranges;
  const sortedFruits = [...fruits].sort((a, b) => {
    // Sort by match count (desc), then by best match score (desc)
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    const aScore = a.bestMatch?.score ?? 0;
    const bScore = b.bestMatch?.score ?? 0;
    return bScore - aScore;
  });

  return (
    <div className="card p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          Per-Fruit Breakdown
        </h3>
        <div className="flex gap-1 p-0.5 bg-[var(--color-bg-muted)] rounded-md">
          <button
            onClick={() => setActiveTab("apples")}
            className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === "apples"
                ? "bg-white text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            🍎 Apples ({apples.length})
          </button>
          <button
            onClick={() => setActiveTab("oranges")}
            className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === "oranges"
                ? "bg-white text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            🍊 Oranges ({oranges.length})
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedFruits.length > 0 ? (
          sortedFruits.map((fruit) => <FruitCard key={fruit.id} fruit={fruit} />)
        ) : (
          <div className="text-center py-8 text-[13px] text-[var(--color-text-tertiary)]">
            No {activeTab} yet
          </div>
        )}
      </div>
    </div>
  );
}
