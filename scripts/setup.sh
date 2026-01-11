#!/bin/bash
# Setup script: seeds database and creates initial matches

set -e

echo "=== Fruit Matchmaking Setup ==="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Run this script from the project root"
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "Error: .env file not found. Copy .env.example and fill in your credentials."
    exit 1
fi

echo "1. Seeding fruits into SurrealDB..."
node scripts/seed-data.mjs

echo ""
echo "2. Creating initial matches (threshold: 0.75)..."
node scripts/batch-match.mjs --threshold=0.75

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  cd frontend && pnpm dev    # Start the frontend"
echo "  Open http://localhost:3000"
