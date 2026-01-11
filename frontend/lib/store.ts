import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Apple {
  id: string;
  name: string;
  attributes: Record<string, unknown>;
  preferences: Record<string, unknown>;
  createdAt: Date;
}

export interface Orange {
  id: string;
  name: string;
  attributes: Record<string, unknown>;
  preferences: Record<string, unknown>;
  createdAt: Date;
}

export interface Match {
  id: string;
  appleId: string;
  appleName?: string;
  orangeId: string;
  orangeName?: string;
  score: number;
  status: "pending" | "confirmed" | "rejected";
  createdAt: Date;
}

export interface Conversation {
  id: string;
  type: "apple" | "orange";
  fruitId: string;
  messages: ConversationMessage[];
  status: "active" | "completed" | "error";
  createdAt: Date;
}

export interface ConversationMessage {
  id: string;
  role: "system" | "user" | "assistant" | "match";
  content: string;
  timestamp: Date;
}

export interface MatchNotification {
  id: string;
  appleId: string;
  orangeId: string;
  score: number;
  announcements: {
    forApple: string;
    forOrange: string;
  };
  timestamp: Date;
}

export interface FeedMessage {
  id: string;
  type: "system" | "apple" | "orange" | "match";
  content: string;
  fruitId?: string;
  matchData?: {
    appleId: string;
    orangeId: string;
    score: number;
  };
  timestamp: Date;
}

interface MatchmakingState {
  apples: Apple[];
  oranges: Orange[];
  matches: Match[];
  conversations: Conversation[];
  notifications: MatchNotification[];
  
  // Split feed messages by panel
  appleFeedMessages: FeedMessage[];
  orangeFeedMessages: FeedMessage[];
  
  // Legacy (kept for backward compatibility)
  feedMessages: FeedMessage[];

  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setApples: (apples: Apple[]) => void;
  setOranges: (oranges: Orange[]) => void;
  addMatch: (match: Match) => void;
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  addMessageToConversation: (
    conversationId: string,
    message: ConversationMessage
  ) => void;
  addNotification: (notification: MatchNotification) => void;
  
  // Panel-specific feed actions
  addAppleFeedMessage: (message: FeedMessage) => void;
  addOrangeFeedMessage: (message: FeedMessage) => void;
  updateAppleFeedMessage: (id: string, content: string) => void;
  updateOrangeFeedMessage: (id: string, content: string) => void;
  clearAppleFeed: () => void;
  clearOrangeFeed: () => void;
  
  // Legacy
  addFeedMessage: (message: FeedMessage) => void;
  clearFeed: () => void;
  
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  apples: [] as Apple[],
  oranges: [] as Orange[],
  matches: [] as Match[],
  conversations: [] as Conversation[],
  notifications: [] as MatchNotification[],
  appleFeedMessages: [] as FeedMessage[],
  orangeFeedMessages: [] as FeedMessage[],
  feedMessages: [] as FeedMessage[],
  activeConversationId: null,
  isLoading: false,
  error: null,
};

export const useMatchmakingStore = create<MatchmakingState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setApples: (apples) => set({ apples }),

        setOranges: (oranges) => set({ oranges }),

        addMatch: (match) =>
          set((state) => ({
            matches: [...state.matches, match],
          })),

        setActiveConversation: (id) => set({ activeConversationId: id }),

        addConversation: (conversation) =>
          set((state) => ({
            conversations: [...state.conversations, conversation],
          })),

        addMessageToConversation: (conversationId, message) =>
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === conversationId
                ? { ...conv, messages: [...conv.messages, message] }
                : conv
            ),
          })),

        addNotification: (notification) =>
          set((state) => ({
            notifications: [...state.notifications, notification],
          })),

        // Panel-specific feed actions
        addAppleFeedMessage: (message) =>
          set((state) => ({
            appleFeedMessages: [...state.appleFeedMessages, message],
          })),

        addOrangeFeedMessage: (message) =>
          set((state) => ({
            orangeFeedMessages: [...state.orangeFeedMessages, message],
          })),

        updateAppleFeedMessage: (id, content) =>
          set((state) => ({
            appleFeedMessages: state.appleFeedMessages.map((msg) =>
              msg.id === id ? { ...msg, content } : msg
            ),
          })),

        updateOrangeFeedMessage: (id, content) =>
          set((state) => ({
            orangeFeedMessages: state.orangeFeedMessages.map((msg) =>
              msg.id === id ? { ...msg, content } : msg
            ),
          })),

        clearAppleFeed: () =>
          set({ appleFeedMessages: [] }),

        clearOrangeFeed: () =>
          set({ orangeFeedMessages: [] }),

        // Legacy
        addFeedMessage: (message) =>
          set((state) => ({
            feedMessages: [...state.feedMessages, message],
          })),

        clearFeed: () =>
          set({ feedMessages: [] }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        reset: () => set(initialState),
      }),
      {
        name: "matchmaking-storage",
        partialize: (state) => ({
          conversations: state.conversations,
          matches: state.matches,
          notifications: state.notifications,
          feedMessages: state.feedMessages,
          appleFeedMessages: state.appleFeedMessages,
          orangeFeedMessages: state.orangeFeedMessages,
        }),
      }
    ),
    { name: "MatchmakingStore" }
  )
);

// Selectors
export const selectActiveConversation = (state: MatchmakingState) =>
  state.conversations.find((c) => c.id === state.activeConversationId);

export const selectMatchCount = (state: MatchmakingState) =>
  state.matches.length;

export const selectSuccessRate = (state: MatchmakingState) => {
  const confirmed = state.matches.filter((m) => m.status === "confirmed").length;
  return state.matches.length > 0
    ? Math.round((confirmed / state.matches.length) * 100)
    : 0;
};
