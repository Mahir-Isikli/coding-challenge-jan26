# AI Integration Guide

## Overview

This project uses two AI services:
1. **OpenAI** - For generating text embeddings (vector representations)
2. **Anthropic Claude** - For generating natural language match announcements

Both are accessed via **Vercel AI SDK v6** (not v4!).

## CRITICAL: AI SDK v6 Breaking Changes

The AI SDK underwent major changes from v4 to v6. **Do not use v4 patterns.**

### Import Changes

```typescript
// ❌ WRONG (v4 style)
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

// ✅ CORRECT (v6 style)
import { generateText, streamText, embedMany } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
```

### Model Specification

```typescript
// ❌ WRONG (v4 style)
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...]
});

// ✅ CORRECT (v6 style)
const { text } = await generateText({
  model: anthropic('claude-opus-4-5-20250514'),
  prompt: 'Your prompt here'
});
```

### Streaming

```typescript
// ❌ WRONG (v4 style)
return new StreamingTextResponse(stream);

// ✅ CORRECT (v6 style)
const result = streamText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  prompt: 'Your prompt'
});
return result.toTextStreamResponse();
```

## OpenAI Embeddings

### Configuration

| Property | Value |
|----------|-------|
| Model | `text-embedding-3-small` |
| Dimensions | 1536 |
| API Key Env | `OPENAI_API_KEY` |

### Why OpenAI for Embeddings?
- Anthropic does not have an embeddings API
- Anthropic recommends Voyage AI, but OpenAI is more common
- `text-embedding-3-small` is cost-effective and high-quality

### Usage

```typescript
import { openai } from '@ai-sdk/openai';
import { embedMany, embed } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'Text to embed',
});
// embedding is number[1536]

// Multiple embeddings (more efficient)
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ['Text 1', 'Text 2', 'Text 3'],
});
// embeddings is number[1536][]
```

### Fruit Embedding Strategy

Convert fruit attributes + preferences to natural language, then embed:

```typescript
async function generateFruitEmbedding(fruit: Fruit): Promise<number[]> {
  const description = `
    Type: ${fruit.type}
    Size: ${fruit.attributes.size ?? "unknown"} (scale 0-14)
    Weight: ${fruit.attributes.weight ?? "unknown"} grams
    Has stem: ${fruit.attributes.hasStem ?? "unknown"}
    Has leaf: ${fruit.attributes.hasLeaf ?? "unknown"}
    Has worm: ${fruit.attributes.hasWorm ?? "unknown"}
    Shine: ${fruit.attributes.shineFactor ?? "unknown"}
    Chemical treated: ${fruit.attributes.hasChemicals ?? "unknown"}
    
    Looking for:
    ${JSON.stringify(fruit.preferences, null, 2)}
  `;
  
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: description,
  });
  
  return embedding;
}
```

## Anthropic Claude (LLM)

### Configuration

| Property | Value |
|----------|-------|
| Model | `claude-opus-4-5-20250514` |
| API Key Env | `ANTHROPIC_API_KEY` |
| Use Case | Match announcements |

### Usage

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text } = await generateText({
  model: anthropic('claude-opus-4-5-20250514'),
  system: 'You are a matchmaker for fruits. Be warm, playful, and celebratory.',
  prompt: `
    An apple just joined looking for love!
    
    Apple's introduction: "${appleDescription}"
    Apple's preferences: "${applePreferences}"
    
    Best match found - an orange!
    Orange's profile: "${orangeDescription}"
    Orange wants: "${orangePreferences}"
    
    Compatibility: ${compatibilityPercent}%
    
    Write a short, fun announcement introducing them to each other.
  `
});

console.log(text);
// "Wonderful news! I've found the perfect orange for you..."
```

### Streaming (for UI)

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const result = streamText({
  model: anthropic('claude-opus-4-5-20250514'),
  prompt: 'Your prompt'
});

// In API route
return result.toTextStreamResponse();

// Or iterate manually
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Deno Edge Function Setup

### deno.json Configuration

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2.4.0",
    "ai": "npm:ai@6.0.23",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@1.2.0",
    "@ai-sdk/openai": "npm:@ai-sdk/openai@1.2.0"
  }
}
```

**CRITICAL:** Use `npm:` prefix for npm packages in Deno.

### Environment Variables

```typescript
// Access in Deno
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
const openaiKey = Deno.env.get("OPENAI_API_KEY");
```

The AI SDK automatically picks up `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from environment.

## Frontend Usage (Next.js)

### Installation

```bash
cd frontend
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai
```

### useChat Hook (if needed)

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

## Error Handling

```typescript
try {
  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    prompt: 'Hello'
  });
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Missing or invalid API key');
  } else if (error.message.includes('rate limit')) {
    console.error('Rate limited - wait and retry');
  } else {
    console.error('AI generation failed:', error);
  }
}
```

### Model Options

| Model | ID | Use Case |
|-------|-----|----------|
| Claude Opus 4.5 | `claude-opus-4-5-20250514` | Best quality, recommended |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | Faster, cheaper alternative |

## Cost Considerations

| Service | Model | Pricing (approx) |
|---------|-------|------------------|
| OpenAI | text-embedding-3-small | $0.02 / 1M tokens |
| Anthropic | claude-3-5-sonnet | $3 / 1M input, $15 / 1M output |

For 40 fruits × ~200 tokens each = ~8K tokens for embeddings ≈ $0.0002

## Troubleshooting

### "Invalid API key"
- Check `.env` has correct keys
- Ensure no quotes around values
- Restart edge functions after changing `.env`

### "Module not found" in Deno
- Add package to `deno.json` with `npm:` prefix
- Restart `supabase functions serve`

### Embeddings wrong dimension
- Must be exactly 1536 for `text-embedding-3-small`
- Check you're using `openai.embedding()` not `openai()`

### "model not found"
- Check model name spelling
- Use full model ID: `claude-3-5-sonnet-20241022`
