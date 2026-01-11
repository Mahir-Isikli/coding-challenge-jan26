# Coding Challenge - Matchmaking System

## Introduction

Hey! Welcome to our little take home challenge. We won't force Leetcode problems down your throat. Instead, what we do here at Clera is build, so therefore, we expect you to build cool stuff too!

But what and why are we building? Well, a lot of the world revolves around matchmaking. The fact that you and I exist is proof of that. A not so insignificant portion of what shapes a person's life is determined by matchmaking: friends, love, jobs. I mean hell, what we're doing right now at this very moment is matchmaking. Despite its prevalence, it is still quite the difficult task. So let's tackle it together—on a small scale at least. Our goal is to connect apples to oranges. Just because we shouldn't compare apples to oranges, doesn't mean we can't try to create a perfect pear… pair.

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd coding-challenge-jan26
pnpm install
cd frontend && pnpm install && cd ..

# 2. Set up environment variables (see below)

# 3. Start the frontend
cd frontend && pnpm dev
```

The app runs at http://localhost:3000. Edge functions are deployed to hosted Supabase.

## Environment Variables

You need **two** env files:

### Root `.env` (for scripts and edge functions)

```bash
# SurrealDB Cloud
SURREAL_URL=wss://your-instance.surreal.cloud
SURREAL_NAMESPACE=your-namespace
SURREAL_DATABASE=your-database
SURREAL_USER=root
SURREAL_PASS=your-password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Anthropic (for edge functions if running locally)
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend `frontend/.env.local` (for Next.js)

```bash
# Supabase (NEXT_PUBLIC_ prefix exposes to client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Anthropic (server-side only, for API routes)
ANTHROPIC_API_KEY=sk-ant-...

# SurrealDB (server-side only, for graph API)
SURREAL_USER=root
SURREAL_PASS=your-password
```

## Problem Statement

The abstract idea of the project is simple. In one basket we have apples, each apple has preferences that it wishes its orange to fulfill. In another basket we have oranges, each orange obviously also has preferences that it wishes a potential apple to meet. Our job is to:

1. Match them based on their joint preferences
2. Communicate to both parties that we've found them a match

We're going to be creating a small fullstack application that will encompass everything from frontend, edge functions as our backend and a bit of creative problem solving on your end to make this come to life.

## Tech Stack

| Layer | Technology | Usage |
|-------|------------|-------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS | App Router, UI components |
| **State** | Zustand | Client-side state with persistence |
| **Utilities** | Effect | Type-safe error handling, retries, timeouts |
| **Backend** | Supabase Edge Functions | Deno runtime, hosted deployment |
| **Database** | SurrealDB Cloud | Graph database for fruits and matches |
| **LLM** | Anthropic Claude | Match announcement generation |

## Data Setup

The `data/raw_apples_and_oranges.json` file contains 40 seed fruits (20 apples, 20 oranges) with attributes and preferences.

### Seeding the Database

If starting fresh with a new SurrealDB instance:

```bash
# Load fruit data into SurrealDB
node scripts/seed-data.mjs

# Optionally create initial matches
node scripts/batch-match.mjs --threshold=0.75
```

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-data.mjs` | Loads fruits from `data/raw_apples_and_oranges.json` into SurrealDB |
| `scripts/batch-match.mjs` | Creates match relationships for fruit pairs above a score threshold |

## Core System

Two edge functions handle the matchmaking: `get-incoming-apple` and `get-incoming-orange`.

### Task Flow

1. **Generate a new fruit** - Random attributes via normal distribution, relaxed preferences
2. **Store in SurrealDB** - With computed description
3. **Bidirectional matching** - Score = avg(apple→orange satisfaction, orange→apple satisfaction)
4. **LLM announcement** - Claude generates playful match messages
5. **Realtime broadcast** - Results pushed to both panels via Supabase Realtime

### Matching Algorithm

```
Combined Score = (Apple's preferences met by Orange + Orange's preferences met by Apple) / 2
```

Each preference is checked against actual attributes:
- Range preferences: `{ min: 5, max: 10 }` → attribute must be in range
- Exact preferences: `"shiny"` → attribute must match exactly
- Boolean preferences: `true/false` → attribute must match

### Running Edge Functions Locally

```bash
# Start Supabase local environment
npx supabase start

# Serve edge functions
npx supabase functions serve --no-verify-jwt

# Test
curl http://127.0.0.1:54321/functions/v1/get-incoming-apple -X POST
```

## Frontend

### Pages

- `/matchmaking` - Main interface with Apple Feed, Match Network graph, Orange Feed
- `/dashboard` - Metrics: fruit counts, match stats, quality distribution, recent matches

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppleChat` | `components/chat/` | Apple feed with "Add Apple" button |
| `OrangeChat` | `components/chat/` | Orange feed with "Add Orange" button |
| `MatchGraph` | `app/matchmaking/` | Force-directed graph of all matches |
| `NavDock` | `components/layout/` | Navigation + "New Session" button |

### State Management (Zustand)

```typescript
// lib/store.ts
useMatchmakingStore.getState().addAppleFeedMessage(message)
useMatchmakingStore.getState().clearAppleFeed()
```

### Effect Usage

```typescript
// lib/utils.ts - Type-safe fetch with retries
const result = await runEffect(
  fetchWithRetry<MetricsResponse>('/api/metrics', {}, 3)
)
```

## Hard Requirements

- The data must be loaded into and queried from SurrealDB
- The communication between the system and the fruits need to be visualized in a medium of your choosing
- You must communicate the matchmaking results through an LLM

## File Structure

```
├── frontend/                          # Next.js 16 application
│   ├── app/
│   │   ├── matchmaking/               # Main matchmaking page
│   │   └── dashboard/                 # Admin dashboard
│   ├── components/
│   │   ├── chat/                      # AppleChat, OrangeChat
│   │   ├── layout/                    # NavDock
│   │   └── ui/                        # shadcn/ui components
│   └── lib/
│       ├── store.ts                   # Zustand state management
│       ├── api.ts                     # Edge function API calls
│       └── utils.ts                   # Effect-based utilities
│
├── supabase/functions/
│   ├── _shared/
│   │   ├── generateFruit.ts           # Fruit generation & communication
│   │   ├── surreal.ts                 # SurrealDB HTTP client
│   │   └── ai.ts                      # Anthropic client
│   ├── get-incoming-apple/            # Apple edge function
│   ├── get-incoming-orange/           # Orange edge function
│   └── get-metrics/                   # Dashboard metrics
│
├── scripts/
│   ├── seed-data.mjs                  # Load fruits into SurrealDB
│   └── batch-match.mjs                # Bulk match creation
│
├── data/
│   └── raw_apples_and_oranges.json    # Seed data (40 fruits)
│
├── .env.example                       # Environment template
└── README.md                          # This file
```
