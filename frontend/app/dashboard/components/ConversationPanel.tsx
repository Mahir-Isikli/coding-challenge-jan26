"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { callIncomingApple, callIncomingOrange } from "@/lib/api";

interface Message {
  id: string;
  type: "system" | "apple" | "orange" | "match";
  content: string;
  timestamp: Date;
  fruitId?: string;
  matchScore?: number;
}

export function ConversationPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to the Fruit Matchmaking System! Click a button below to start a new matching conversation.",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"apple" | "orange" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewApple = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingType("apple");

    // Add "searching" message
    const searchingId = `searching-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: searchingId,
        type: "system",
        content: "A new apple has arrived! Generating profile and searching for a match...",
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await callIncomingApple();
      
      // Add the apple's introduction
      setMessages((prev) => [
        ...prev,
        {
          id: response.apple?.id || `apple-${Date.now()}`,
          type: "apple",
          content: response.apple?.description || "An apple has joined the matchmaking pool.",
          timestamp: new Date(),
          fruitId: response.apple?.id,
        },
      ]);

      // Add match result
      if (response.match) {
        setMessages((prev) => [
          ...prev,
          {
            id: `match-${Date.now()}`,
            type: "match",
            content: response.match!.announcement,
            timestamp: new Date(),
            matchScore: response.match!.score,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `no-match-${Date.now()}`,
            type: "system",
            content: "No matching oranges found yet. Try adding some oranges to the pool!",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: "system",
          content: `Error: ${error instanceof Error ? error.message : "Failed to process apple"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleNewOrange = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingType("orange");

    const searchingId = `searching-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: searchingId,
        type: "system",
        content: "A new orange has arrived! Generating profile and searching for a match...",
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await callIncomingOrange();
      
      setMessages((prev) => [
        ...prev,
        {
          id: response.orange?.id || `orange-${Date.now()}`,
          type: "orange",
          content: response.orange?.description || "An orange has joined the matchmaking pool.",
          timestamp: new Date(),
          fruitId: response.orange?.id,
        },
      ]);

      if (response.match) {
        setMessages((prev) => [
          ...prev,
          {
            id: `match-${Date.now()}`,
            type: "match",
            content: response.match!.announcement,
            timestamp: new Date(),
            matchScore: response.match!.score,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `no-match-${Date.now()}`,
            type: "system",
            content: "No matching apples found yet. Try adding some apples to the pool!",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: "system",
          content: `Error: ${error instanceof Error ? error.message : "Failed to process orange"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: "welcome",
        type: "system",
        content: "Conversation cleared. Ready for new matches!",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">Matchmaking Conversation</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Live
          </span>
        </div>
        <button
          onClick={clearConversation}
          className="rounded px-2 py-1 text-sm text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Clear
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
            </div>
            <span>
              {loadingType === "apple" ? "Processing apple" : "Processing orange"}...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Action Buttons */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-3">
          <button
            onClick={handleNewApple}
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-lg px-4 py-3 font-medium transition-all",
              "bg-red-500 text-white hover:bg-red-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <span className="mr-2">🍎</span>
            New Apple
          </button>
          <button
            onClick={handleNewOrange}
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-lg px-4 py-3 font-medium transition-all",
              "bg-orange-500 text-white hover:bg-orange-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <span className="mr-2">🍊</span>
            New Orange
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const getMessageStyles = () => {
    switch (message.type) {
      case "apple":
        return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50";
      case "orange":
        return "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/50";
      case "match":
        return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50";
      default:
        return "bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700";
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case "apple":
        return "🍎";
      case "orange":
        return "🍊";
      case "match":
        return "🍐";
      default:
        return "💬";
    }
  };

  const getLabel = () => {
    switch (message.type) {
      case "apple":
        return "Apple";
      case "orange":
        return "Orange";
      case "match":
        return "Match Found!";
      default:
        return "System";
    }
  };

  return (
    <div className={cn("rounded-lg border p-4", getMessageStyles())}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{getIcon()}</span>
          <span className="text-sm font-medium">{getLabel()}</span>
          {message.matchScore !== undefined && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
              {(message.matchScore * 100).toFixed(1)}% match
            </span>
          )}
        </div>
        <span className="text-xs text-muted">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      {message.fruitId && (
        <p className="mt-2 text-xs text-muted">ID: {message.fruitId}</p>
      )}
    </div>
  );
}
