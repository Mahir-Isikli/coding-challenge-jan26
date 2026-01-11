"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/matchmaking", label: "Matchmaking" },
  { href: "/dashboard", label: "Dashboard" },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex gap-6" role="tablist">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "relative py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-text)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
