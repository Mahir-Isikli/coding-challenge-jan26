"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Markdown } from "./Markdown";
import { useMatchmakingStore, type FeedMessage } from "@/lib/store";

export function ConversationPanel() {
  const { feedMessages, addFeedMessage, clearFeed } = useMatchmakingStore();
  const [activeType, setActiveType] = useState<"apple" | "orange" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedRef = useRef<string | null>(null);
  const activeTypeRef = useRef<"apple" | "orange" | null>(null);
  
  // Keep ref in sync with state
  activeTypeRef.current = activeType;

  // Apple chat hook
  const appleChat = useChat({
    id: "apple-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat/apple",
    }),
  });

  // Orange chat hook
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
  }, [feedMessages, appleChat.messages, orangeChat.messages]);

  // Process completed messages using a callback to avoid setState in effect
  const processCompletedMessage = (chat: typeof appleChat, type: "apple" | "orange") => {
    if (chat.status !== "ready" || activeTypeRef.current !== type) return;

    const assistantMsg = chat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return;

    const msgId = assistantMsg.id;
    if (lastProcessedRef.current === msgId) return;

    const content = assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    if (content) {
      lastProcessedRef.current = msgId;
      addFeedMessage({
        id: `match-${Date.now()}`,
        type: "match",
        content,
        timestamp: new Date(),
      });
      // Use setTimeout to defer state update outside of render cycle
      setTimeout(() => setActiveType(null), 0);
    }
  };

  // Watch for completed assistant messages
  useEffect(() => {
    processCompletedMessage(appleChat, "apple");
    processCompletedMessage(orangeChat, "orange");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appleChat.status, orangeChat.status, appleChat.messages, orangeChat.messages]);

  // Get streaming content from the active chat
  const getStreamingContent = () => {
    const chat = activeType === "apple" ? appleChat : orangeChat;
    const assistantMsg = chat.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) return "";

    return assistantMsg.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
  };

  const handleNewApple = async () => {
    if (appleChat.status === "streaming" || orangeChat.status === "streaming") return;
    setActiveType("apple");
    lastProcessedRef.current = null;

    addFeedMessage({
      id: `apple-${Date.now()}`,
      type: "apple",
      content: "Joining the pool...",
      timestamp: new Date(),
    });

    // Clear previous messages and send
    appleChat.setMessages([]);
    appleChat.sendMessage({ text: "Create a new apple and find a match" });
  };

  const handleNewOrange = async () => {
    if (appleChat.status === "streaming" || orangeChat.status === "streaming") return;
    setActiveType("orange");
    lastProcessedRef.current = null;

    addFeedMessage({
      id: `orange-${Date.now()}`,
      type: "orange",
      content: "Joining the pool...",
      timestamp: new Date(),
    });

    // Clear previous messages and send
    orangeChat.setMessages([]);
    orangeChat.sendMessage({ text: "Create a new orange and find a match" });
  };

  const isLoading = appleChat.status === "streaming" || orangeChat.status === "streaming";
  const streamingContent = getStreamingContent();

  return (
    <div className="card flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Feed</span>
          {isLoading && (
            <span className="text-xs text-tertiary">(streaming...)</span>
          )}
        </div>
        <button
          onClick={() => {
            clearFeed();
            appleChat.setMessages([]);
            orangeChat.setMessages([]);
            setActiveType(null);
            lastProcessedRef.current = null;
          }}
          className="text-xs text-tertiary hover:text-secondary"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {feedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
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

        {/* Loading indicator when no content yet */}
        {isLoading && !streamingContent && (
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>
              {activeType === "apple" ? "Processing apple" : "Processing orange"}...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t flex gap-2">
        <button
          onClick={handleNewApple}
          disabled={isLoading}
          className="btn btn-primary flex-1"
        >
          {activeType === "apple" && isLoading ? "Adding..." : "Add Apple"}
        </button>
        <button
          onClick={handleNewOrange}
          disabled={isLoading}
          className="btn btn-secondary flex-1"
        >
          {activeType === "orange" && isLoading ? "Adding..." : "Add Orange"}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: FeedMessage }) {
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
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
