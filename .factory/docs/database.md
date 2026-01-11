# Database Documentation (SurrealDB)

## Connection Details

| Property | Value |
|----------|-------|
| Provider | SurrealDB Cloud |
| Region | AWS EU-West-1 (Ireland) |
| URL | `wss://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud` |
| Namespace | `clera-namespace` |
| Database | `clera-db` |
| Version | 2.4.0 |

## Authentication

### Root User (Recommended)
```
Username: root
Password: clera-matchmaking-2024!
```

### Via CLI
```bash
surreal sql \
  --endpoint wss://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud \
  --username root \
  --password 'clera-matchmaking-2024!' \
  --namespace clera-namespace \
  --database clera-db \
  --pretty
```

### Via JavaScript SDK
```typescript
import Surreal from 'surrealdb';

const db = new Surreal();

await db.connect("wss://clera-db-06dpv0t3mtv7j25egvjnmpaib8.aws-euw1.surreal.cloud", {
  namespace: "clera-namespace",
  database: "clera-db",
  auth: {
    username: "root",
    password: "clera-matchmaking-2024!"
  }
});
```

### GOTCHA: JWT Tokens
SurrealDB Cloud dashboard provides JWT tokens that **expire in ~10 minutes**. Always use username/password auth for development.

## Schema

### Tables Overview

| Table | Type | Purpose |
|-------|------|---------|
| `fruit` | SCHEMALESS | Stores apples and oranges |
| `match` | SCHEMAFULL | Stores successful matches |
| `conversation` | SCHEMAFULL | Stores chat visualization data |

### Fruit Table

```surql
DEFINE TABLE fruit SCHEMALESS;
DEFINE INDEX fruit_type_idx ON fruit FIELDS type;
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | record | Auto-generated (e.g., `fruit:apple_0`) |
| `type` | string | `"apple"` or `"orange"` |
| `attributes` | object | Physical characteristics |
| `attributes.size` | float \| null | 0-14 scale |
| `attributes.weight` | int \| null | Grams |
| `attributes.hasStem` | bool \| null | Has stem attached |
| `attributes.hasLeaf` | bool \| null | Has leaf attached |
| `attributes.hasWorm` | bool \| null | Contains worm |
| `attributes.shineFactor` | string \| null | `dull`, `neutral`, `shiny`, `extraShiny` |
| `attributes.hasChemicals` | bool \| null | Chemically treated |
| `preferences` | object | What this fruit wants in a match |
| `embedding` | array\<float\> \| null | 1536-dim OpenAI embedding |
| `communication` | object | Natural language descriptions |
| `created_at` | datetime | Auto-set on creation |

### Match Table

```surql
DEFINE TABLE match SCHEMAFULL;
DEFINE FIELD apple ON match TYPE record<fruit>;
DEFINE FIELD orange ON match TYPE record<fruit>;
DEFINE FIELD apple_to_orange_score ON match TYPE float;
DEFINE FIELD orange_to_apple_score ON match TYPE float;
DEFINE FIELD mutual_score ON match TYPE float;
DEFINE FIELD vector_similarity ON match TYPE option<float>;
DEFINE FIELD llm_announcement ON match TYPE option<string>;
DEFINE FIELD created_at ON match TYPE datetime DEFAULT time::now();
```

### Conversation Table

```surql
DEFINE TABLE conversation SCHEMAFULL;
DEFINE FIELD fruit ON conversation TYPE record<fruit>;
DEFINE FIELD messages ON conversation TYPE array DEFAULT [];
DEFINE FIELD status ON conversation TYPE string DEFAULT "active";
DEFINE FIELD match_result ON conversation TYPE option<record<match>>;
DEFINE FIELD created_at ON conversation TYPE datetime DEFAULT time::now();
```

## Seed Data

**Location:** `/data/raw_apples_and_oranges.json`

**Contents:**
- 20 apples (IDs: `fruit:apple_0` through `fruit:apple_19`)
- 20 oranges (IDs: `fruit:orange_20` through `fruit:orange_39`)

**Status:** ✅ Loaded into SurrealDB Cloud

### Verify Data
```surql
SELECT type, count() FROM fruit GROUP BY type;
-- Returns: apple: 20, orange: 20
```

## Common Queries

### Get all fruits
```surql
SELECT * FROM fruit;
```

### Get fruits by type
```surql
SELECT * FROM fruit WHERE type = "apple";
SELECT * FROM fruit WHERE type = "orange";
```

### Get fruit by ID
```surql
SELECT * FROM fruit:apple_0;
```

### Count fruits
```surql
SELECT type, count() FROM fruit GROUP BY type;
```

### Vector similarity search (once embeddings are added)
```surql
LET $query = [0.1, 0.2, ...];  -- 1536-dim vector
SELECT *, vector::distance::knn() AS similarity
FROM fruit
WHERE type = "orange"
  AND embedding <|5,64|> $query
ORDER BY similarity
LIMIT 5;
```

### Create a match
```surql
CREATE match CONTENT {
  apple: fruit:apple_0,
  orange: fruit:orange_20,
  apple_to_orange_score: 0.85,
  orange_to_apple_score: 0.72,
  mutual_score: 0.78,
  vector_similarity: 0.91,
  llm_announcement: "Great news! Found a perfect match..."
};
```

### Get recent matches
```surql
SELECT * FROM match ORDER BY created_at DESC LIMIT 10;
```

### Get match statistics
```surql
SELECT 
  count() AS total_matches,
  math::mean(mutual_score) AS avg_score,
  math::min(mutual_score) AS min_score,
  math::max(mutual_score) AS max_score
FROM match;
```

## Vector Index (TODO)

Once embeddings are generated, create HNSW index:

```surql
DEFINE INDEX fruit_embedding_idx 
  ON fruit 
  FIELDS embedding 
  HNSW DIMENSION 1536 
  DIST COSINE;
```

**Note:** The index can only be created after at least one fruit has a non-null embedding.

## Troubleshooting

### "There was a problem with authentication"
- Use username/password, not JWT token
- Check credentials in `.env`
- Verify namespace and database names

### "Table not found"
- Tables are created automatically on first insert
- Run the schema definition commands if needed

### "Field type mismatch"
- Fruit table is SCHEMALESS - fields are flexible
- Match/Conversation tables are SCHEMAFULL - must match schema

### Slow vector queries
- Ensure HNSW index is created
- Check embedding dimension matches (1536)
- Reduce `<|k,ef|>` parameters for faster (less accurate) search
