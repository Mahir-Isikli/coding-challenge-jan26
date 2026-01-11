"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Markdown } from "@/app/dashboard/components/Markdown";
import { useMatchmakingStore, type FeedMessage } from "@/lib/store";

export function OrangeChat() {
  const { orangeFeedMessages, addOrangeFeedMessage, clearOrangeFeed } = useMatchmakingStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedRef = useRef<string | null>(null);

  const orangeChat = useChat({
    id: "orange-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat/orange",
    }),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [orangeFeedMessages, orangeChat.messages]);

  useEffect(() => {
    if (orangeChat.status !== "ready" || !isProcessing) return;

    const assistantMsg = orangeChat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return;

    const msgId = assistantMsg.id;
    if (lastProcessedRef.current === msgId) return;

    const content = assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    if (content) {
      lastProcessedRef.current = msgId;
      addOrangeFeedMessage({
        id: `match-orange-${Date.now()}`,
        type: "match",
        content,
        timestamp: new Date(),
      });
      setTimeout(() => setIsProcessing(false), 0);
    }
  }, [orangeChat.status, orangeChat.messages, isProcessing, addOrangeFeedMessage]);

  const getStreamingContent = () => {
    const assistantMsg = orangeChat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return "";

    return assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
  };

  const handleNewOrange = async () => {
    if (orangeChat.status === "streaming") return;
    setIsProcessing(true);
    lastProcessedRef.current = null;

    addOrangeFeedMessage({
      id: `orange-${Date.now()}`,
      type: "orange",
      content: "New orange joining the matchmaking pool...",
      timestamp: new Date(),
    });

    orangeChat.setMessages([]);
    orangeChat.sendMessage({ text: "Create a new orange and find a match" });
  };

  const isLoading = orangeChat.status === "streaming";
  const streamingContent = getStreamingContent();

  return (
    <div className="card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span>🍊</span>
          <span className="text-sm font-medium">Orange Feed</span>
          {isLoading && (
            <span className="text-xs text-tertiary">(streaming...)</span>
          )}
        </div>
        <button
          onClick={() => {
            clearOrangeFeed();
            orangeChat.setMessages([]);
            setIsProcessing(false);
            lastProcessedRef.current = null;
          }}
          className="text-xs text-tertiary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {orangeFeedMessages.map((msg) => (
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
            <span>Processing orange...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t">
        <button
          onClick={handleNewOrange}
          disabled={isLoading}
          className="btn btn-secondary w-full"
        >
          {isLoading ? "Adding..." : "Add Orange"}
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
