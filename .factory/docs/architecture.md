# Architecture Overview

## System Design

This is a **fruit matchmaking system** that demonstrates talent-job matching (Clera's core product). The metaphor:
- **Apples** = Job seekers / Candidates
- **Oranges** = Job opportunities / Companies
- **Matching** = Finding mutual compatibility based on preferences

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                            │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐    │
│  │   Conversation View     │    │    Dashboard / Metrics      │    │
│  │   (Chat Interface)      │    │    (Analytics)              │    │
│  └───────────┬─────────────┘    └──────────────┬──────────────┘    │
└──────────────┼──────────────────────────────────┼───────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE EDGE FUNCTIONS                        │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐    │
│  │  get-incoming-apple     │    │   get-incoming-orange       │    │
│  │  - Generate fruit       │    │   - Generate fruit          │    │
│  │  - Create embedding     │    │   - Create embedding        │    │
│  │  - Find matches         │    │   - Find matches            │    │
│  │  - LLM announcement     │    │   - LLM announcement        │    │
│  └───────────┬─────────────┘    └──────────────┬──────────────┘    │
└──────────────┼──────────────────────────────────┼───────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  SurrealDB   │    │   OpenAI     │    │  Anthropic   │          │
│  │  Cloud       │    │   Embeddings │    │  Claude LLM  │          │
│  │  (Vector DB) │    │   (1536 dim) │    │  (Text Gen)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. New Fruit Arrives (e.g., Apple)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Generate   │────▶│   Generate   │────▶│   Store in   │
│   Random     │     │   Natural    │     │   SurrealDB  │
│   Fruit      │     │   Language   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Create     │
                     │   Embedding  │
                     │   (OpenAI)   │
                     └──────────────┘
```

### 2. Find Matches

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vector     │────▶│  Preference  │────▶│   Rank by    │
│   Similarity │     │   Scoring    │     │   Combined   │
│   Search     │     │   (Both Dir) │     │   Score      │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐
       │             │   Mutual     │
       │             │   Score =    │
       │             │   √(A→O×O→A) │
       │             └──────────────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────────────┐
│  Final Score = 0.3×Vector + 0.7×Mutual │
└─────────────────────────────────────┘
```

### 3. Announce Match

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Best       │────▶│   Claude     │────▶│   Return     │
│   Match      │     │   LLM        │     │   Response   │
│   Selected   │     │   Writes     │     │   + Store    │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Component Hierarchy

### Frontend (`/frontend`)

```
app/
├── layout.tsx          # Root layout (fonts, metadata)
├── page.tsx            # Redirects to /dashboard
├── globals.css         # CSS variables, Tailwind config
└── dashboard/
    ├── page.tsx        # Dashboard component (scaffolding)
    └── loader.ts       # Server-side data fetching

lib/
├── store.ts            # Zustand store (state management)
└── utils.ts            # Effect-TS utilities (fetch helpers)
```

### Backend (`/supabase/functions`)

```
functions/
├── _shared/
│   ├── generateFruit.ts      # Fruit generation logic (COMPLETE)
│   ├── generateFruit.test.ts # Tests
│   └── deno.json             # Shared imports
├── get-incoming-apple/
│   ├── index.ts              # Edge function handler
│   └── deno.json             # Function imports
└── get-incoming-orange/
    ├── index.ts              # Edge function handler
    └── deno.json             # Function imports
```

## Key Design Decisions

### Why SurrealDB?
- Native HNSW vector indexing (no separate vector DB needed)
- SQL-like query language with graph capabilities
- Cloud offering with generous free tier
- Supports complex preference matching queries

### Why Separate Embeddings (OpenAI) and LLM (Anthropic)?
- Anthropic doesn't have an embeddings API
- OpenAI's `text-embedding-3-small` is cost-effective and high-quality
- Claude excels at natural, warm communication (matches Clera's brand)

### Why Effect-TS?
- Already in the codebase (frontend utilities)
- Type-safe error handling for API calls
- Composable retry/timeout logic

### Why Bidirectional Scoring?
- Real matchmaking requires mutual compatibility
- Apple's preferences for orange AND orange's preferences for apple
- Geometric mean ensures both parties are satisfied

## State Management

### Zustand Store (`lib/store.ts`)

```typescript
interface MatchmakingState {
  // Data
  apples: Apple[];
  oranges: Orange[];
  matches: Match[];
  conversations: Conversation[];
  
  // UI State
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setApples, setOranges, addMatch, addConversation, ...
}
```

### Persistence
- Conversations and matches persisted to localStorage
- Fruits loaded fresh from SurrealDB on each visit

## API Design

### Edge Function Response Format

```typescript
interface MatchResponse {
  fruit: StoredFruit;           // The newly created fruit
  match: MatchedFruit;          // Best match found
  announcement: string;         // LLM-generated text
  conversation: Message[];      // Chat messages for UI
}

interface Message {
  role: 'fruit' | 'system' | 'matchmaker';
  content: string;
}
```

## Security Considerations

- API keys stored in `.env` (gitignored)
- SurrealDB uses root user auth (not expiring JWT tokens)
- Edge functions run server-side (keys never exposed to client)
- CORS configured for local development only
