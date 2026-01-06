# Matchmaking Dashboard - Frontend

This is the frontend application for the Apple & Orange Matchmaking System.

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) - you'll be redirected to the dashboard.

## Tech Stack

- **React 19** - UI library
- **Next.js 16** - Full-stack React framework
- **Tailwind CSS 4** - Utility-first CSS
- **Zustand** - State management
- **Effect** - Functional programming library for TypeScript

## Project Structure

```
frontend/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx      # Dashboard page component
│   │   └── loader.ts     # Server-side data loading
│   ├── globals.css       # Global styles & CSS variables
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home (redirects to /dashboard)
├── lib/
│   ├── store.ts          # Zustand store for state management
│   └── utils.ts          # Utility functions
└── public/
    └── favicon.ico
```

## Key Files to Modify

### Dashboard (`app/dashboard/`)

- **`page.tsx`** - Main dashboard UI. Add your metrics cards, visualization components, and match tables here.
- **`loader.ts`** - Server-side data fetching. Connect to SurrealDB and edge functions here.

### State Management (`lib/store.ts`)

The Zustand store is pre-configured with:
- Types for `Apple`, `Orange`, `Match`, and `Conversation`
- Actions for managing state
- Persistence middleware (saves to localStorage)

### Styling (`app/globals.css`)

CSS variables are defined for theming. Component classes include:
- `.card` - Card container
- `.metric-card` - Metric display cards
- `.btn-primary` / `.btn-secondary` - Button styles
- `.text-muted`, `.text-apple`, `.text-orange`, `.text-pear` - Text colors

## Tasks to Complete

1. **Connect to SurrealDB** - Implement the data loader in `loader.ts`
2. **Build the Visualization** - Create a component to visualize matchmaking conversations
3. **Add Metrics & Analytics** - Track and display system performance
4. **Implement Real-time Updates** - Show live matchmaking results

## Helpful Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Effect Documentation](https://effect.website/docs)
- [SurrealDB JavaScript SDK](https://surrealdb.com/docs/sdk/javascript)
