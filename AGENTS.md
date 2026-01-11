# Agent Instructions: Clera Matchmaking Challenge

## About Clera & This Challenge

**Clera** (getclera.com) is an AI talent matching platform. This coding challenge demonstrates core matching concepts using a fruit metaphor:

| Fruit | Represents | Has |
|-------|------------|-----|
| **Apple** | Employer/Job | Job requirements (preferences) + job attributes |
| **Orange** | Candidate | Candidate skills (attributes) + candidate preferences |

The matching is **bidirectional**: the candidate must fit the job requirements AND the job must fit what the candidate wants.

## Matching Algorithm

Hybrid scoring with three components:
- **Preference Satisfaction (40%)** - Do attributes meet stated preferences? Checked both directions.
- **Embedding Similarity (35%)** - Semantic match from natural language descriptions
- **Collaborative Filtering (25%)** - Graph traversal: "What did similar fruits match with?"

## Edge Function Deployment

**IMPORTANT**: Edge functions run on hosted Supabase, not locally.

After ANY changes to `supabase/functions/`:
```bash
# Deploy to hosted Supabase
pnpm supabase functions deploy get-incoming-apple --no-verify-jwt
pnpm supabase functions deploy get-incoming-orange --no-verify-jwt

# Test E2E via API to confirm it works
curl -X POST https://fwqoutllbbwyhrucsvly.supabase.co/functions/v1/get-incoming-apple \
  -H "Content-Type: application/json" -d '{}'

curl -X POST https://fwqoutllbbwyhrucsvly.supabase.co/functions/v1/get-incoming-orange \
  -H "Content-Type: application/json" -d '{}'
```

Always deploy and test E2E after making changes to edge functions.

## Quick Start

```bash
# Install dependencies (use pnpm, not npm)
pnpm install
cd frontend && pnpm install

# Start frontend dev server
cd frontend && pnpm dev
```

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 + React 19 | App Router, Tailwind CSS, Zustand |
| Backend | Supabase Edge Functions | Deno runtime, hosted on Supabase |
| Database | SurrealDB Cloud | Graph DB with vector search, HTTP endpoint for edge functions |
| Embeddings | OpenAI | `text-embedding-3-small` (1536 dims) |
| LLM | Anthropic Claude | `claude-sonnet-4-20250514` for match announcements |

## Critical Gotchas

1. **AI SDK doesn't work in Deno** - Use direct fetch calls (see `_shared/ai.ts`)
2. **SurrealDB uses HTTP in edge functions** - WSS doesn't work reliably (see `_shared/surreal.ts`)
3. **Use pnpm, not npm** - Throughout the project
4. **Graph relationships** - Use `RELATE fruit -> matched -> fruit` for matches

## File Structure

```
/
├── data/raw_apples_and_oranges.json  # Seed data (40 fruits)
├── frontend/                          # Next.js app
│   ├── app/                           # Pages (matchmaking, dashboard)
│   ├── components/chat/               # AppleChat, OrangeChat components
│   └── lib/                           # Store, utils, realtime hooks
├── supabase/functions/
│   ├── _shared/                       # Shared: ai.ts, surreal.ts, generateFruit.ts
│   ├── get-incoming-apple/            # Apple edge function
│   └── get-incoming-orange/           # Orange edge function
└── .env                               # Credentials (already configured)
```

## Implementation Status

| Component | Status |
|-----------|--------|
| SurrealDB Cloud | ✅ Schema + 40 fruits seeded |
| Edge functions | ✅ Deployed to hosted Supabase |
| Hybrid matching | ✅ Preference + Embedding + Collaborative |
| Graph relationships | ✅ RELATE edges with score breakdown |
| LLM announcements | ✅ Honest about preference violations |
| Realtime broadcast | ✅ Matches pushed via Supabase Realtime |
| Frontend UI | ✅ Two-panel chat + Match Network graph |
| Dashboard | ✅ Metrics at `/dashboard` |
