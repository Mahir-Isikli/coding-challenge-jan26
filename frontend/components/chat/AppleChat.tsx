"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Markdown } from "@/app/dashboard/components/Markdown";
import { useMatchmakingStore, type FeedMessage } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

export function AppleChat() {
  const { appleFeedMessages, addAppleFeedMessage, updateAppleFeedMessage } = useMatchmakingStore();
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

    const joiningMsgId = `apple-${Date.now()}`;
    addAppleFeedMessage({
      id: joiningMsgId,
      type: "apple",
      content: "Joining the pool...",
      timestamp: new Date(),
    });

    try {
      // Call API route which handles edge function + LLM streaming + Realtime broadcast
      const response = await fetch('/api/chat/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.statusText}`);
      }

      // Create a new message for streaming content
      const streamMsgId = `stream-apple-${Date.now()}`;
      addAppleFeedMessage({
        id: streamMsgId,
        type: "match",
        content: "",
        timestamp: new Date(),
      });

      // Read the stream (plain text from toTextStreamResponse)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          updateAppleFeedMessage(streamMsgId, fullContent);
        }
      }
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
    <Card className="flex flex-col h-full py-0 gap-0">
      <CardHeader className="px-4 py-3 h-11 flex items-center justify-center border-b flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-center gap-2 leading-none">
          Apple Feed
          {isLoading && (
            <Badge variant="secondary" className="text-xs py-0 h-5">processing...</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        {appleFeedMessages.length === 0 && !isLoading ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex items-center justify-center"
            >
              <Empty className="border-none">
                <EmptyHeader>
                  <span className="text-3xl">🍏</span>
                  <EmptyTitle className="text-base">No apples yet</EmptyTitle>
                  <EmptyDescription>
                    Click the button below to add an apple and find a match
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full p-4">
              <AnimatePresence mode="wait">
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {appleFeedMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageBubble message={msg} />
                  </motion.div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>Finding match...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </motion.div>
              </AnimatePresence>
            </ScrollArea>
          </div>
        )}
      </CardContent>

      <CardFooter className="px-4 py-4 border-t flex-shrink-0">
        <Button 
          onClick={handleNewApple} 
          disabled={isLoading} 
          className="w-full bg-[#4CAF50] hover:bg-[#43A047] text-white"
        >
          {isLoading ? "Adding..." : "Add Apple"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function useFormattedTime(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
