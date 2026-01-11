"use client";

import { useEffect, useRef } from "react";
import { supabase, isRealtimeConfigured } from "./supabase";
import { useMatchmakingStore, type MatchNotification, type FeedMessage } from "./store";

interface BroadcastPayload {
  appleId: string;
  orangeId: string;
  score: number;
  announcements: {
    forApple: string;
    forOrange: string;
  };
}

// Track processed messages to prevent duplicates from React Strict Mode or reconnections
const processedMessages = new Set<string>();

export function useRealtimeMatches() {
  const { 
    addNotification, 
    addMatch,
    addAppleFeedMessage,
    addOrangeFeedMessage,
  } = useMatchmakingStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isRealtimeConfigured()) {
      console.log("[Realtime] Skipping - NEXT_PUBLIC_SUPABASE_ANON_KEY not configured");
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      return;
    }

    const channel = supabase.channel("matches", {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on("broadcast", { event: "new_match" }, (message) => {
        const payload = message.payload as BroadcastPayload;
        
        // Deduplicate using apple+orange+score as unique key
        const msgKey = `${payload.appleId}-${payload.orangeId}-${payload.score}`;
        if (processedMessages.has(msgKey)) {
          console.log("[Realtime] Skipping duplicate message:", msgKey);
          return;
        }
        processedMessages.add(msgKey);
        
        // Clean up old entries after 10 seconds to prevent memory leak
        setTimeout(() => processedMessages.delete(msgKey), 10000);

        const notification: MatchNotification = {
          id: `notif-${Date.now()}`,
          appleId: payload.appleId,
          orangeId: payload.orangeId,
          score: payload.score,
          announcements: payload.announcements,
          timestamp: new Date(),
        };
        addNotification(notification);

        addMatch({
          id: `match-${Date.now()}`,
          appleId: payload.appleId,
          orangeId: payload.orangeId,
          score: payload.score,
          status: "confirmed",
          createdAt: new Date(),
        });

        // Route to Apple panel
        const appleMessage: FeedMessage = {
          id: `feed-apple-${Date.now()}`,
          type: "match",
          content: payload.announcements.forApple,
          fruitId: payload.appleId,
          matchData: {
            appleId: payload.appleId,
            orangeId: payload.orangeId,
            score: payload.score,
          },
          timestamp: new Date(),
        };
        addAppleFeedMessage(appleMessage);

        // Route to Orange panel
        const orangeMessage: FeedMessage = {
          id: `feed-orange-${Date.now()}`,
          type: "match",
          content: payload.announcements.forOrange,
          fruitId: payload.orangeId,
          matchData: {
            appleId: payload.appleId,
            orangeId: payload.orangeId,
            score: payload.score,
          },
          timestamp: new Date(),
        };
        addOrangeFeedMessage(orangeMessage);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected to matches channel");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Failed to subscribe to matches channel");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [addNotification, addMatch, addAppleFeedMessage, addOrangeFeedMessage]);
}
