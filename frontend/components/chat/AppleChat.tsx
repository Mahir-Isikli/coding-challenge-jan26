"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Markdown } from "@/app/dashboard/components/Markdown";
import { useMatchmakingStore, type FeedMessage } from "@/lib/store";

export function AppleChat() {
  const { appleFeedMessages, addAppleFeedMessage, clearAppleFeed } = useMatchmakingStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedRef = useRef<string | null>(null);

  const appleChat = useChat({
    id: "apple-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat/apple",
    }),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [appleFeedMessages, appleChat.messages]);

  useEffect(() => {
    if (appleChat.status !== "ready" || !isProcessing) return;

    const assistantMsg = appleChat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return;

    const msgId = assistantMsg.id;
    if (lastProcessedRef.current === msgId) return;

    const content = assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    if (content) {
      lastProcessedRef.current = msgId;
      addAppleFeedMessage({
        id: `match-apple-${Date.now()}`,
        type: "match",
        content,
        timestamp: new Date(),
      });
      setTimeout(() => setIsProcessing(false), 0);
    }
  }, [appleChat.status, appleChat.messages, isProcessing, addAppleFeedMessage]);

  const getStreamingContent = () => {
    const assistantMsg = appleChat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return "";

    return assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
  };

  const handleNewApple = async () => {
    if (appleChat.status === "streaming") return;
    setIsProcessing(true);
    lastProcessedRef.current = null;

    addAppleFeedMessage({
      id: `apple-${Date.now()}`,
      type: "apple",
      content: "New apple joining the matchmaking pool...",
      timestamp: new Date(),
    });

    appleChat.setMessages([]);
    appleChat.sendMessage({ text: "Create a new apple and find a match" });
  };

  const isLoading = appleChat.status === "streaming";
  const streamingContent = getStreamingContent();

  return (
    <div className="card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span>🍎</span>
          <span className="text-sm font-medium">Apple Feed</span>
          {isLoading && (
            <span className="text-xs text-tertiary">(streaming...)</span>
          )}
        </div>
        <button
          onClick={() => {
            clearAppleFeed();
            appleChat.setMessages([]);
            setIsProcessing(false);
            lastProcessedRef.current = null;
          }}
          className="text-xs text-tertiary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {appleFeedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && streamingContent && (
          <div className="message message-match">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Match</span>
                <span className="badge badge-live text-xs">Live</span>
              </div>
              <span className="text-xs text-tertiary font-mono">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="text-sm leading-relaxed prose prose-sm max-w-none">
              <Markdown content={streamingContent} />
            </div>
            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-0.5" />
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Processing apple...</span>
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
