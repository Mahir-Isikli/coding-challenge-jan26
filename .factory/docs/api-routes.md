# API Routes (Supabase Edge Functions)

## Overview

Edge functions run on Deno runtime via Supabase. They handle:
1. Generating new fruits
2. Creating embeddings
3. Finding matches
4. Generating LLM announcements

**Base URL (local):** `http://127.0.0.1:54321/functions/v1/`

## Running Locally

```bash
# Start Supabase (includes Postgres, but we use SurrealDB)
pnpm supabase start

# Serve edge functions (separate terminal)
pnpm supabase functions serve --no-verify-jwt

# Functions available at:
# http://127.0.0.1:54321/functions/v1/get-incoming-apple
# http://127.0.0.1:54321/functions/v1/get-incoming-orange
```

## Endpoints

### POST /get-incoming-apple

Generates a new apple, finds matching oranges, and returns LLM announcement.

**Request:**
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/get-incoming-apple \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (expected, once implemented):**
```json
{
  "fruit": {
    "id": "fruit:apple_new_1",
    "type": "apple",
    "attributes": {
      "size": 7.2,
      "weight": 185,
      "hasStem": true,
      "hasLeaf": false,
      "hasWorm": false,
      "shineFactor": "shiny",
      "hasChemicals": false
    },
    "preferences": {
      "size": { "min": 5, "max": 12 },
      "hasWorm": false,
      "shineFactor": ["shiny", "extraShiny"]
    },
    "communication": {
      "attributes": "Let me tell you about myself. I'm an apple...",
      "preferences": "Here's what I'm looking for in a match..."
    }
  },
  "match": {
    "id": "fruit:orange_24",
    "type": "orange",
    "attributes": { ... },
    "similarity": 0.89,
    "appleToOrangeScore": 0.85,
    "orangeToAppleScore": 0.72,
    "mutualScore": 0.78,
    "finalScore": 0.81
  },
  "announcement": "Wonderful news! I've found the perfect orange for you...",
  "conversation": [
    { "role": "fruit", "content": "Let me tell you about myself..." },
    { "role": "fruit", "content": "Here's what I'm looking for..." },
    { "role": "system", "content": "Searching for compatible oranges..." },
    { "role": "system", "content": "Found 5 candidates!" },
    { "role": "matchmaker", "content": "Wonderful news! I've found..." }
  ]
}
```

**Current Response (stub):**
```json
{
  "message": "Apple received"
}
```

### POST /get-incoming-orange

Same as apple endpoint, but generates an orange and finds matching apples.

**Request:**
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/get-incoming-orange \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Implementation Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/get-incoming-apple` | 🔲 Stub | Returns `{ message: "Apple received" }` |
| `/get-incoming-orange` | 🔲 Stub | Returns `{ message: "Orange received" }` |

## Current Code Structure

### `/supabase/functions/get-incoming-apple/index.ts`

```typescript
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new apple instance ✅
    const apple = generateApple();

    // Step 2: Capture the apple's communication ✅
    const appleAttrs = communicateAttributes(apple);
    const applePrefs = communicatePreferences(apple);

    // Step 3: Store the new apple in SurrealDB 🔲 TODO
    // Step 4: Match the new apple to existing oranges 🔲 TODO
    // Step 5: Communicate matching results via LLM 🔲 TODO

    return new Response(JSON.stringify({ message: "Apple received" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Error handling...
  }
});
```

## Adding Dependencies to Edge Functions

Edit the function's `deno.json`:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2.4.0",
    "surrealdb": "npm:surrealdb@1.0.0",
    "ai": "npm:ai@6.0.23",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@1.2.0",
    "@ai-sdk/openai": "npm:@ai-sdk/openai@1.2.0"
  }
}
```

**CRITICAL:** Use `npm:` prefix for npm packages in Deno.

## Environment Variables in Edge Functions

Edge functions access env vars via `Deno.env.get()`:

```typescript
const surrealUrl = Deno.env.get("SURREAL_URL");
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
```

For local development, set in `.env` file at project root.

For production, set via Supabase dashboard or CLI:
```bash
supabase secrets set SURREAL_URL=wss://...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## CORS Configuration

All endpoints include CORS headers for local development:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

## Error Response Format

```json
{
  "error": "Failed to process incoming apple",
  "details": "Error message here"
}
```

## Testing

### Using curl
```bash
# Test apple endpoint
curl -X POST http://127.0.0.1:54321/functions/v1/get-incoming-apple \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# Test orange endpoint
curl -X POST http://127.0.0.1:54321/functions/v1/get-incoming-orange \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### Using fetch (frontend)
```typescript
const response = await fetch('http://127.0.0.1:54321/functions/v1/get-incoming-apple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
const data = await response.json();
```

## Shared Code

### `/supabase/functions/_shared/generateFruit.ts`

Contains fruit generation and communication logic:

| Function | Description |
|----------|-------------|
| `generateApple()` | Creates random apple with attributes/preferences |
| `generateOrange()` | Creates random orange with attributes/preferences |
| `communicateAttributes(fruit)` | Natural language description of attributes |
| `communicatePreferences(fruit)` | Natural language description of preferences |

**This file is complete and tested.** Do not modify unless adding new fruit types.
