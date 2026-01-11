/**
 * SurrealDB HTTP Client for Deno Edge Functions
 * 
 * Uses HTTP RPC endpoint instead of WebSocket for better compatibility
 * with serverless/edge environments (no persistent connections needed).
 */

const SURREAL_URL = Deno.env.get("SURREAL_URL") || "https://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud";
const SURREAL_NAMESPACE = Deno.env.get("SURREAL_NAMESPACE") || "clera-namespace";
const SURREAL_DATABASE = Deno.env.get("SURREAL_DATABASE") || "clera-db";
const SURREAL_USER = Deno.env.get("SURREAL_USER") || "root";
const SURREAL_PASS = Deno.env.get("SURREAL_PASS") || "clera-matchmaking-2024!";

// Convert wss:// to https:// for HTTP endpoint
function getHttpEndpoint(url: string): string {
  return url.replace("wss://", "https://").replace("ws://", "http://");
}

interface SurrealResponse<T = unknown> {
  result: T;
  status: string;
  time: string;
}

interface SurrealError {
  code: number;
  message: string;
}

export class SurrealHTTP {
  private baseUrl: string;
  private namespace: string;
  private database: string;
  private authHeader: string;

  constructor() {
    this.baseUrl = getHttpEndpoint(SURREAL_URL);
    this.namespace = SURREAL_NAMESPACE;
    this.database = SURREAL_DATABASE;
    this.authHeader = "Basic " + btoa(`${SURREAL_USER}:${SURREAL_PASS}`);
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/sql`, {
      method: "POST",
      headers: {
        "Authorization": this.authHeader,
        "Accept": "application/json",
        "Content-Type": "text/plain",
        "Surreal-NS": this.namespace,
        "Surreal-DB": this.database,
      },
      body: vars ? `${sql}` : sql,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SurrealDB query failed: ${response.status} - ${errorText}`);
    }

    const results = await response.json() as SurrealResponse<T>[];
    
    // Check for errors in results
    for (const result of results) {
      if (result.status === "ERR") {
        throw new Error(`SurrealDB error: ${JSON.stringify(result)}`);
      }
    }

    return results.map(r => r.result);
  }

  async create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
    const sql = `CREATE ${table} CONTENT $data;`;
    const results = await this.query<T[]>(sql.replace("$data", JSON.stringify(data)));
    return results[0]?.[0] as T;
  }

  async select<T = unknown>(table: string, id?: string): Promise<T[]> {
    const sql = id ? `SELECT * FROM ${table}:${id};` : `SELECT * FROM ${table};`;
    const results = await this.query<T[]>(sql);
    return results[0] || [];
  }

  async relate<T = unknown>(
    from: string,
    edge: string,
    to: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const contentPart = data ? ` CONTENT ${JSON.stringify(data)}` : "";
    const sql = `RELATE ${from} -> ${edge} -> ${to}${contentPart};`;
    const results = await this.query<T[]>(sql);
    return results[0]?.[0] as T;
  }
}

export const db = new SurrealHTTP();
