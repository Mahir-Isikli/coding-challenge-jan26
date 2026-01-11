"use client";

import { useRef, useEffect, useState } from "react";
import { Markdown } from "@/app/dashboard/components/Markdown";
import { useMatchmakingStore, type FeedMessage } from "@/lib/store";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";

export function AppleChat() {
  const { appleFeedMessages, addAppleFeedMessage, clearAppleFeed } = useMatchmakingStore();
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [appleFeedMessages]);

  const handleNewApple = async () => {
    if (isLoading) return;
    setIsLoading(true);

    addAppleFeedMessage({
      id: `apple-${Date.now()}`,
      type: "apple",
      content: "New apple joining the matchmaking pool...",
      timestamp: new Date(),
    });

    try {
      // Call edge function directly - it handles everything including Realtime broadcast
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-incoming-apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.statusText}`);
      }

      // Realtime will deliver the match announcement to the feed
    } catch (error) {
      console.error('Error adding apple:', error);
      addAppleFeedMessage({
        id: `error-${Date.now()}`,
        type: "system",
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span>🍎</span>
          <span className="text-sm font-medium">Apple Feed</span>
          {isLoading && (
            <span className="text-xs text-tertiary">(processing...)</span>
          )}
        </div>
        <button
          onClick={clearAppleFeed}
          className="text-xs text-tertiary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {appleFeedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Finding match...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t">
        <button
          onClick={handleNewApple}
          disabled={isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading ? "Adding..." : "Add Apple"}
        </button>
      </div>
    </div>
  );
}

function useFormattedTime(timestamp: Date | string): string {
  const [formatted, setFormatted] = useState("");
  
  useEffect(() => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    setFormatted(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [timestamp]);
  
  return formatted;
}

function MessageBubble({ message }: { message: FeedMessage }) {
  const formattedTime = useFormattedTime(message.timestamp);
  
  const cls = {
    system: "message-system",
    apple: "message-apple",
    orange: "message-orange",
    match: "message-match",
  }[message.type];

  const label = { system: "System", apple: "Apple", orange: "Orange", match: "Match" }[
    message.type
  ];

  const useMarkdown = message.type === "match";

  return (
    <div className={`message ${cls}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs text-tertiary font-mono">
          {formattedTime}
        </span>
      </div>
      {useMarkdown ? (
        <div className="text-sm leading-relaxed prose prose-sm max-w-none">
          <Markdown content={message.content} />
        </div>
      ) : (
        <p className="text-sm leading-relaxed">{message.content}</p>
      )}
    </div>
  );
}
