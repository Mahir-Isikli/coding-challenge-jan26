import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";

// SurrealDB HTTP endpoint
const SURREAL_URL = "https://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud";
const SURREAL_NS = "clera-namespace";
const SURREAL_DB = "clera-db";
const SURREAL_USER = process.env.SURREAL_USER || "root";
const SURREAL_PASS = process.env.SURREAL_PASS || "clera-matchmaking-2024!";

interface SurrealResponse<T> {
  result: T;
  status: string;
  time: string;
}

interface FruitRecord {
  id: string;
  type: 'apple' | 'orange';
  description?: string;
}

interface MatchRecord {
  id: string;
  in: string;
  out: string;
  score: number;
}

async function querySurreal<T>(sql: string): Promise<T[]> {
  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64'),
      'Accept': 'application/json',
      'Content-Type': 'text/plain',
      'Surreal-NS': SURREAL_NS,
      'Surreal-DB': SURREAL_DB,
    },
    body: sql,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`SurrealDB query failed: ${response.status}`);
  }

  const results = await response.json() as SurrealResponse<T>[];
  return results.map(r => r.result);
}

export async function GET() {
  try {
    // Get all fruits
    const fruitsResult = await querySurreal<FruitRecord[]>(`
      SELECT id, type, description FROM fruit;
    `);
    const fruits = fruitsResult[0] || [];

    // Get all matches
    const matchesResult = await querySurreal<MatchRecord[]>(`
      SELECT id, in, out, score FROM matched;
    `);
    const matches = matchesResult[0] || [];

    // Transform to graph format
    const nodes = fruits.map(f => ({
      id: f.id,
      type: f.type,
      name: f.description?.slice(0, 60) || f.id,
    }));

    const links = matches.map(m => ({
      source: m.in,
      target: m.out,
      score: m.score,
      id: m.id,
    }));

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', nodes: [], links: [] },
      { status: 500 }
    );
  }
}
