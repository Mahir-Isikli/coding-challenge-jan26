"use client";

import { AppleChat } from "@/components/chat/AppleChat";
import { OrangeChat } from "@/components/chat/OrangeChat";
import { MatchGraph } from "@/app/dashboard/components/MatchGraph";
import { useRealtimeMatches } from "@/lib/useRealtimeMatches";

export default function MatchmakingPage() {
  // Subscribe to realtime match events
  useRealtimeMatches();

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        {/* Left: Apple Chat */}
        <div className="min-h-0">
          <AppleChat />
        </div>

        {/* Center: Match Network Graph */}
        <div className="min-h-0">
          <div className="card h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex-shrink-0">
              <h3 className="text-sm font-medium">Match Network</h3>
              <p className="text-xs text-tertiary mt-0.5">
                Visualizing fruit relationships
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <MatchGraph />
            </div>
          </div>
        </div>

        {/* Right: Orange Chat */}
        <div className="min-h-0">
          <OrangeChat />
        </div>
      </div>
    </main>
  );
}
