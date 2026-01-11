"use client";

import { AppleChat } from "@/components/chat/AppleChat";
import { OrangeChat } from "@/components/chat/OrangeChat";
import { MatchGraph, MatchGraphLegend } from "@/app/dashboard/components/MatchGraph";
import { useRealtimeMatches } from "@/lib/useRealtimeMatches";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export default function MatchmakingPage() {
  // Subscribe to realtime match events
  useRealtimeMatches();

  return (
    <main className="max-w-[1600px] mx-auto px-6 pt-4 pb-20">
      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-180px)]">
        {/* Left: Apple Chat */}
        <div className="min-h-0">
          <AppleChat />
        </div>

        {/* Center: Match Network Graph (wider - 2 columns) */}
        <div className="min-h-0 col-span-2">
          <Card className="h-full flex flex-col overflow-hidden py-0 gap-0">
            <CardHeader className="px-4 py-3 h-11 flex items-center justify-center border-b flex-shrink-0">
              <CardTitle className="text-sm text-center leading-none">Match Network</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <MatchGraph />
            </CardContent>
            <CardFooter className="px-4 py-3 justify-center border-t flex-shrink-0">
              <MatchGraphLegend />
            </CardFooter>
          </Card>
        </div>

        {/* Right: Orange Chat */}
        <div className="min-h-0">
          <OrangeChat />
        </div>
      </div>
    </main>
  );
}
