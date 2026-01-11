"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMatchmakingStore } from "@/lib/store";
import { Plus } from "lucide-react";

const tabs = [
  { href: "/matchmaking", label: "Matchmaking" },
  { href: "/dashboard", label: "Dashboard" },
];

export function NavDock() {
  const pathname = usePathname();
  const { clearAppleFeed, clearOrangeFeed } = useMatchmakingStore();

  const handleNewMatchmaking = () => {
    clearAppleFeed();
    clearOrangeFeed();
  };

  return (
    <div className="sticky top-0 z-50 flex justify-center py-4 bg-[var(--color-bg)]">
      <div className="flex items-center gap-2">
        <nav
          className="flex items-center gap-1 rounded-full bg-neutral-200/70 p-1"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-colors rounded-full",
                  isActive
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    style={{ zIndex: -1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {pathname === "/matchmaking" && (
          <button
            onClick={handleNewMatchmaking}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-full bg-white shadow-sm border border-neutral-200/60 text-[var(--color-text)] hover:bg-neutral-50 transition-colors"
          >
            <Plus className="size-4" />
            New Session
          </button>
        )}
      </div>
    </div>
  );
}
