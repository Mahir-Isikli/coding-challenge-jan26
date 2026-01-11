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

  const isMatchmaking = pathname === "/matchmaking";

  return (
    <div className="sticky top-0 z-50 flex justify-center py-4 bg-[var(--color-bg)]">
      <nav
        className="flex items-center gap-6"
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
                "relative px-1 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
            </Link>
          );
        })}

        <button
          onClick={handleNewMatchmaking}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200",
            isMatchmaking
              ? "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
              : "bg-transparent border-transparent text-transparent pointer-events-none"
          )}
        >
          <Plus className="size-4" />
          New Session
        </button>
      </nav>
    </div>
  );
}
