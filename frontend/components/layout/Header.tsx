"use client";

export function Header() {
  return (
    <header className="border-b sticky top-0 bg-[var(--color-bg)] z-50">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center">
        <h1 className="text-sm font-medium">Fruit Matchmaking</h1>
      </div>
    </header>
  );
}
