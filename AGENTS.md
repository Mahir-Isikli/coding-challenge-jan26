# Agent Instructions: Clera Matchmaking Challenge

## Project Overview

A fruit matchmaking system that connects "apples" with "oranges" based on their attributes and preferences. This is a coding challenge for Clera (an AI talent matching platform) - the fruit metaphor represents candidate-job matching. The system uses SurrealDB for vector storage, OpenAI for embeddings, and Anthropic Claude for natural language match announcements.

**Timebox**: 4 hours | **Status**: Database setup complete, implementation in progress

## Quick Start

```bash
# Install dependencies (use pnpm, not npm)
pnpm install
cd frontend && pnpm install

# Start Supabase local environment
pnpm supabase start

# Serve edge functions (separate terminal)
pnpm supabase functions serve --no-verify-jwt

# Start frontend dev server (separate terminal)
cd frontend && pnpm dev

# Test edge function
curl http://127.0.0.1:54321/functions/v1/get-incoming-apple -H "Content-Type: application/json" -d '{}'
```

## Tech Stack Summary

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Frontend | Next.js | 16.1.1 | App Router, React 19 |
| UI | Tailwind CSS | 4.x | Custom CSS variables in globals.css |
| State | Zustand | 5.0.0 | Persisted store in `lib/store.ts` |
| Effects | Effect-TS | 3.12.0 | Used in `lib/utils.ts` for fetch |
| Backend | Supabase Edge Functions | - | Deno runtime |
| Database | SurrealDB Cloud | 2.4.0 | AWS EU-West-1, **use HTTP endpoint in edge functions** |
| Embeddings | OpenAI | text-embedding-3-small | 1536 dimensions, direct fetch API |
| LLM | Anthropic Claude | claude-sonnet-4-20250514 | Direct fetch API (not AI SDK) |
| AI SDK | N/A | - | **NOT USED** - AI SDK doesn't work well in Deno edge functions |

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](.factory/docs/architecture.md) | System design, data flow, component hierarchy |
| [database.md](.factory/docs/database.md) | SurrealDB schema, connection, seed data |
| [api-routes.md](.factory/docs/api-routes.md) | Edge functions, endpoints, request/response |
| [ai-integration.md](.factory/docs/ai-integration.md) | OpenAI embeddings, Anthropic LLM setup |
| [SPEC.md](SPEC.md) | Full implementation specification |

## Critical Knowledge

### GOTCHA 1: AI SDK Does NOT Work in Deno Edge Functions
AI SDK is primarily designed for Node.js and has import issues in Deno runtime.
**Use direct fetch calls instead:**

```typescript
// OpenAI Embeddings - direct fetch
const response = await fetch("https://api.openai.com/v1/embeddings", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "text-embedding-3-small",
    input: texts,
  }),
});

// Anthropic Claude - direct fetch
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
});
```

See `supabase/functions/_shared/ai.ts` for the full implementation.

### GOTCHA 2: SurrealDB - Use HTTP in Edge Functions, WSS in Node.js
WebSocket connections in edge functions are risky due to cold starts.
**Use HTTP endpoint for edge functions, WSS for local Node.js testing:**

```typescript
// Edge Functions - HTTP endpoint (see _shared/surreal.ts)
const baseUrl = "https://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud";
await fetch(`${baseUrl}/sql`, {
  method: "POST",
  headers: {
    "Authorization": "Basic " + btoa(`${user}:${pass}`),
    "NS": "clera-namespace",
    "DB": "clera-db",
  },
  body: sql,
});

// Node.js (test-surreal.mjs) - WebSocket is fine
await db.connect("wss://clera-db-....surreal.cloud", { ... });
```

### GOTCHA 3: SurrealDB Cloud Authentication
- JWT tokens expire in ~10 minutes
- Use root user credentials instead: `root` / `clera-matchmaking-2024!`
- Connection requires namespace AND database selection

```typescript
// CORRECT way to connect
await db.connect("wss://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud", {
  namespace: "clera-namespace",
  database: "clera-db",
  auth: { username: "root", password: "clera-matchmaking-2024!" }
});
```

### GOTCHA 4: Use RELATE for Graph Edges (Matches)
SurrealDB's power is in graph relationships. Use `RELATE` instead of a separate match table:

```sql
-- Create a match relationship
RELATE fruit:apple_123 -> matched -> fruit:orange_456 CONTENT {
  score: 0.87,
  matched_at: time::now()
};

-- Query matches with arrow syntax
SELECT ->matched->fruit FROM fruit:apple_123;
```

### GOTCHA 5: Anthropic Has No Embeddings API
- Anthropic recommends Voyage AI for embeddings
- We use OpenAI `text-embedding-3-small` instead (1536 dims)
- Need BOTH `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`

### GOTCHA 6: Package Manager
- **Use pnpm, not npm** throughout the project
- Root and frontend have separate `node_modules`

## File Structure Overview

```
/
├── .env                    # Credentials (gitignored) - ALREADY CONFIGURED
├── SPEC.md                 # Full implementation spec
├── AGENTS.md               # This file
├── data/
│   └── raw_apples_and_oranges.json  # Seed data (40 fruits)
├── frontend/               # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx        # Redirects to /dashboard
│   │   ├── dashboard/      # Metrics dashboard (scaffolding)
│   │   └── layout.tsx      # Root layout with fonts
│   └── lib/
│       ├── store.ts        # Zustand store (scaffolding)
│       └── utils.ts        # Effect-TS utilities
├── supabase/
│   ├── config.toml         # Supabase local config
│   └── functions/
│       ├── _shared/
│       │   ├── generateFruit.ts  # Fruit generation (IMPLEMENTED)
│       │   ├── surreal.ts        # SurrealDB HTTP client (IMPLEMENTED)
│       │   └── ai.ts             # OpenAI/Anthropic fetch clients (IMPLEMENTED)
│       ├── get-incoming-apple/   # Edge function (IMPLEMENTED)
│       └── get-incoming-orange/  # Edge function (IMPLEMENTED)
└── package.json            # Root package (supabase CLI)
```

## Common Tasks

### Add a new edge function
```bash
cd supabase/functions
mkdir my-function
# Create index.ts and deno.json (copy from existing)
```

### Query SurrealDB via CLI
```bash
surreal sql \
  --endpoint wss://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud \
  --username root \
  --password 'clera-matchmaking-2024!' \
  --namespace clera-namespace \
  --database clera-db \
  --pretty
```

### Generate embeddings for a fruit
```typescript
// In edge functions - use direct fetch (see _shared/ai.ts)
import { generateEmbedding } from "../_shared/ai.ts";
const embedding = await generateEmbedding(fruitDescription);

// In Node.js - can use AI SDK if needed
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: [fruitDescription],
});
```

### Test the matching flow
```bash
# 1. Start services
pnpm supabase start
pnpm supabase functions serve --no-verify-jwt

# 2. Call edge function
curl -X POST http://127.0.0.1:54321/functions/v1/get-incoming-apple \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SURREAL_URL` | Yes | SurrealDB Cloud WebSocket URL |
| `SURREAL_NAMESPACE` | Yes | `clera-namespace` |
| `SURREAL_DATABASE` | Yes | `clera-db` |
| `SURREAL_USER` | Yes | `root` |
| `SURREAL_PASS` | Yes | Database password |
| `ANTHROPIC_API_KEY` | Yes | For Claude LLM (match announcements) |
| `OPENAI_API_KEY` | Yes | For embeddings (text-embedding-3-small) |

**Current .env is already configured with all credentials.**

## Debugging Tips

### "There was a problem with authentication" (SurrealDB)
- JWT token expired - use username/password auth instead
- Check namespace/database are correct: `clera-namespace` / `clera-db`

### Edge function not found
- Run `pnpm supabase functions serve --no-verify-jwt`
- Check function is listed in `supabase/config.toml`

### Embeddings returning wrong dimensions
- Must be exactly 1536 for `text-embedding-3-small`
- Check you're using `openai.embedding()` not `openai()`

### "Module not found" in Deno
- Add to function's `deno.json` imports with `npm:` prefix
- Restart `supabase functions serve`

## Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| SurrealDB Cloud | ✅ Done | Schema created, 40 fruits loaded |
| Root user auth | ✅ Done | No more token expiry issues |
| Fruit generation | ✅ Done | `generateFruit.ts` complete |
| SurrealDB HTTP client | ✅ Done | `_shared/surreal.ts` - HTTP endpoint for edge functions |
| AI fetch clients | ✅ Done | `_shared/ai.ts` - OpenAI embeddings + Anthropic Claude |
| Edge functions | ✅ Done | `get-incoming-apple` and `get-incoming-orange` implemented |
| Embeddings | ✅ Done | Generated on-the-fly when new fruit is created |
| Matching algorithm | ✅ Done | Cosine similarity on embeddings |
| RELATE edges | ✅ Done | Using SurrealDB graph relationships |
| LLM announcements | ✅ Done | Anthropic Claude via direct fetch |
| Conversation UI | 🔲 TODO | Chat interface |
| Dashboard | 🔲 TODO | Metrics visualization |
