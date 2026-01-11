# LLM Announcement Style Guide

## Current Style (Disabled for Testing)

The matchmaker has a playful, witty personality:
- Uses fruit puns and emojis
- Charming and slightly humorous tone
- 2-3 sentences, keeps it light

Example prompt:
```
You are a witty matchmaker for fruits. Announce matches in a fun, playful way.
Keep responses to 2-3 sentences. Be charming and slightly humorous.
```

Example output:
```
🍊💕🍎 MATCH ALERT! 🍎💕🍊

Well hello there, gorgeous gleaming orange! I've found you a delightfully shiny apple 
who checks ALL your boxes - they're a petite 7.7 units, completely worm-free, and 
sporting that lovely shiny finish you adore! 69.8% compatibility - not too shabby 
for a cross-species romance! 🌟
```

## Testing Style (Currently Active)

Dry, factual announcements for easier debugging:
- No emojis or puns
- Just the facts: what matched, scores, violations
- Easy to parse and verify

Example output:
```
Match found: apple_9
Score: 69.8%
- Preference: 100% (all satisfied)
- Embedding: 85%
- Collaborative: 0%

Satisfied: size, weight, hasWorm, shineFactor, hasChemicals
Violated: none
```

## Switching Styles

To switch back to playful mode, update the system prompts in:
- `supabase/functions/get-incoming-apple/index.ts`
- `supabase/functions/get-incoming-orange/index.ts`

Then redeploy:
```bash
pnpm supabase functions deploy get-incoming-apple --no-verify-jwt
pnpm supabase functions deploy get-incoming-orange --no-verify-jwt
```
