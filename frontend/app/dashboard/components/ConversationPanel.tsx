"use client";

import { useState, useRef, useEffect } from "react";
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
      content: "Ready. Add a fruit to start matching.",
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

    setMessages((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, type: "system", content: "Generating apple...", timestamp: new Date() },
    ]);

    try {
      const response = await callIncomingApple();
      setMessages((prev) => [
        ...prev,
        {
          id: response.apple?.id || `a-${Date.now()}`,
          type: "apple",
          content: response.apple?.description || "Apple added.",
          timestamp: new Date(),
          fruitId: response.apple?.id,
        },
      ]);

      if (response.match) {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            type: "match",
            content: response.match!.announcement,
            timestamp: new Date(),
            matchScore: response.match!.score,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, type: "system", content: `Error: ${error instanceof Error ? error.message : "Failed"}`, timestamp: new Date() },
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

    setMessages((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, type: "system", content: "Generating orange...", timestamp: new Date() },
    ]);

    try {
      const response = await callIncomingOrange();
      setMessages((prev) => [
        ...prev,
        {
          id: response.orange?.id || `o-${Date.now()}`,
          type: "orange",
          content: response.orange?.description || "Orange added.",
          timestamp: new Date(),
          fruitId: response.orange?.id,
        },
      ]);

      if (response.match) {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            type: "match",
            content: response.match!.announcement,
            timestamp: new Date(),
            matchScore: response.match!.score,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, type: "system", content: `Error: ${error instanceof Error ? error.message : "Failed"}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className="card flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Feed</span>
        </div>
        <button 
          onClick={() => setMessages([{ id: "c", type: "system", content: "Cleared.", timestamp: new Date() }])} 
          className="text-xs text-tertiary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <div className="loading-dots"><span></span><span></span><span></span></div>
            <span>{loadingType === "apple" ? "Processing apple" : "Processing orange"}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t flex gap-2">
        <button onClick={handleNewApple} disabled={isLoading} className="btn btn-primary flex-1">
          Add Apple
        </button>
        <button onClick={handleNewOrange} disabled={isLoading} className="btn btn-secondary flex-1">
          Add Orange
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const cls = {
    system: "message-system",
    apple: "message-apple",
    orange: "message-orange",
    match: "message-match",
  }[message.type];

  const label = { system: "System", apple: "Apple", orange: "Orange", match: "Match" }[message.type];

  return (
    <div className={`message ${cls}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
          {message.matchScore !== undefined && (
            <span className="badge badge-success text-xs">{(message.matchScore * 100).toFixed(0)}%</span>
          )}
        </div>
        <span className="text-xs text-tertiary font-mono">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{message.content}</p>
      {message.fruitId && (
        <p className="text-xs text-tertiary font-mono mt-2">{message.fruitId}</p>
      )}
    </div>
  );
}
