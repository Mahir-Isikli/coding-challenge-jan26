# UI Restructure - Two-Page Layout with Split Chat View

## Summary

Restructure the frontend into two separate pages with proper routing:
1. **`/matchmaking`** - Three-column layout: Apple Chat | Match Network | Orange Chat
2. **`/dashboard`** - Stats and metrics (current sidebar content, expanded)

Use shadcn/ui Tabs component for page navigation, positioned below the header. Both chat panels update simultaneously when a match is found (true two-way communication).

## Key Decisions

- **Full shadcn/ui setup** - Initialize and use Tabs component for navigation
- **Three equal columns (33% each)** - Apple Chat | Match Network Graph | Orange Chat
- **Both panels update on match** - When adding either fruit, match announcements appear in BOTH panels
- **Separate routes** - `/matchmaking` and `/dashboard` with browser back/forward support
- **Tab bar below header** - Clean separation between header and content

## Scope

**In scope:**
- Install and configure shadcn/ui
- Create `/matchmaking` page with three-column layout
- Create `/dashboard` page with current stats content
- Add Tabs navigation component below header
- Split current ConversationPanel into AppleChat and OrangeChat components
- Update Realtime/Zustand to route messages to correct panel
- Ensure Match Network graph resizes properly in middle column

**Out of scope:**
- New stats/charts functionality (keep current design)
- Mobile responsive changes (desktop focus for now)
- Additional shadcn components beyond Tabs

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Header: Fruit Matchmaking                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  [ Matchmaking ]  [ Dashboard ]    ← Tab bar (shadcn Tabs)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /matchmaking:                                                          │
│  ┌───────────────┬───────────────┬───────────────┐                     │
│  │  Apple Chat   │ Match Network │  Orange Chat  │  ← Equal thirds     │
│  │               │               │               │                      │
│  │  [Messages]   │   🍎──🍊     │  [Messages]   │                      │
│  │               │    \ /        │               │                      │
│  │               │   🍊──🍎     │               │                      │
│  │               │               │               │                      │
│  │  [Add Apple]  │               │ [Add Orange]  │                      │
│  └───────────────┴───────────────┴───────────────┘                     │
│                                                                         │
│  /dashboard:                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Stats | Match Quality | Recent Matches                         │   │
│  │  (Current sidebar content, expanded to full width)              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Two-Way Message Flow

```
User clicks "Add Apple" in Apple panel:
  │
  ├─→ Apple Chat: "New apple joining..."
  │
  ├─→ Edge function finds match with Orange #42
  │
  ├─→ Broadcast via Supabase Realtime:
  │     { forApple: "You matched!", forOrange: "Someone found you!" }
  │
  ├─→ Apple Chat: Shows forApple message
  │
  └─→ Orange Chat: Shows forOrange message (simultaneously)
```

## Implementation Plan

1. **Install shadcn/ui**
   - Run `npx shadcn@latest init`
   - Add Tabs component: `npx shadcn@latest add tabs`

2. **Create page structure**
   - Create `/app/matchmaking/page.tsx`
   - Move stats content to `/app/dashboard/page.tsx`
   - Update `/app/page.tsx` to redirect to `/matchmaking`

3. **Build layout components**
   - Create `components/layout/TabNav.tsx` - shadcn Tabs for page switching
   - Create `components/layout/Header.tsx` - Shared header
   - Update `app/layout.tsx` to include Header + TabNav

4. **Split chat components**
   - Create `components/chat/AppleChat.tsx` - Apple-specific chat panel
   - Create `components/chat/OrangeChat.tsx` - Orange-specific chat panel
   - Each has own "Add" button and message feed

5. **Update Zustand store**
   - Split `feedMessages` into `appleFeedMessages` and `orangeFeedMessages`
   - Update `addFeedMessage` to accept target panel
   - Update Realtime hook to route messages to correct panel

6. **Build three-column matchmaking page**
   - Use CSS Grid or Flexbox for equal thirds
   - AppleChat | MatchGraph | OrangeChat
   - Same height for all three columns

7. **Build dashboard page**
   - Extract current Sidebar component content
   - Expand to full-width layout
   - Keep current stats, match quality, recent matches

## File Changes

| File | Action |
|------|--------|
| `frontend/` | Run shadcn init |
| `components/ui/tabs.tsx` | NEW - shadcn Tabs |
| `components/layout/TabNav.tsx` | NEW - Page navigation |
| `components/layout/Header.tsx` | NEW - Shared header |
| `components/chat/AppleChat.tsx` | NEW - Apple chat panel |
| `components/chat/OrangeChat.tsx` | NEW - Orange chat panel |
| `app/matchmaking/page.tsx` | NEW - Three-column layout |
| `app/dashboard/page.tsx` | UPDATE - Stats only, full width |
| `app/page.tsx` | UPDATE - Redirect to /matchmaking |
| `app/layout.tsx` | UPDATE - Include Header + TabNav |
| `lib/store.ts` | UPDATE - Split feed messages by panel |
| `lib/useRealtimeMatches.ts` | UPDATE - Route to correct panel |

## Open Questions

- Should the Match Network graph auto-refresh when new matches are created?
- Should there be a visual indicator connecting the two chat panels when a match happens?
