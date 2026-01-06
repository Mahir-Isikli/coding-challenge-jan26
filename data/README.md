# Fruit Data Schema

This document describes the data models used in the matchmaking system for apples and oranges.

---

## Overview

Each fruit entity (Apple or Orange) consists of two main components:

1. **Attributes** — Physical characteristics of the fruit, randomly generated upon creation
2. **Preferences** — Desired attribute values the fruit seeks in a potential match

---

## Fruit Entity

### Base Structure

```typescript
interface Fruit {
  type: "apple" | "orange";
  attributes: FruitAttributes;r
  preferences: FruitPreferences;
}
```

---

## Attributes

Physical characteristics assigned to each fruit upon generation.

### Schema

```typescript
interface FruitAttributes {
  size: number | null;
  weight: number | null;
  hasStem: boolean | null;
  hasLeaf: boolean | null;
  hasWorm: boolean | null;
  shineFactor: ShineFactor | null;
  hasChemicals: boolean | null;
}
```

### Attribute Definitions

| Attribute      | Type                   | Description                                       |
|----------------|------------------------|---------------------------------------------------|
| `size`         | `number \| null`       | Physical size of the fruit (arbitrary units)      |
| `weight`       | `number \| null`       | Weight of the fruit (arbitrary units)             |
| `hasStem`      | `boolean \| null`      | Whether the fruit has a stem attached             |
| `hasLeaf`      | `boolean \| null`      | Whether the fruit has a leaf attached             |
| `hasWorm`      | `boolean \| null`      | Whether the fruit contains a worm                 |
| `shineFactor`  | `ShineFactor \| null`  | Surface shine level of the fruit                  |
| `hasChemicals` | `boolean \| null`      | Whether the fruit has been treated with chemicals |

> **Note:** All attributes are nullable. A `null` value indicates the attribute is unknown or has not been determined.

### Enumerations

#### ShineFactor

```typescript
type ShineFactor = "dull" | "neutral" | "shiny" | "extraShiny";
```

| Value        | Description                          |
|--------------|--------------------------------------|
| `dull`       | Matte, non-reflective surface        |
| `neutral`    | Standard surface appearance          |
| `shiny`      | Polished, reflective surface         |
| `extraShiny` | Highly polished, mirror-like surface |

---

## Preferences

A fruit's preferences define the desired attribute values it seeks in a potential match. Preferences are expressed as a partial set of attributes — only attributes the fruit cares about are included.

### Schema

```typescript
interface NumberRange {
  min?: number;
  max?: number;
}

interface FruitPreferences {
  size?: NumberRange;
  weight?: NumberRange;
  hasStem?: boolean;
  hasLeaf?: boolean;
  hasWorm?: boolean;
  shineFactor?: ShineFactor | ShineFactor[];
  hasChemicals?: boolean;
}
```

### Preference Rules

1. **Optional Fields** — A fruit may specify preferences for any subset of attributes
2. **Numeric Ranges** — Numeric preferences (`size`, `weight`) are expressed as ranges with optional `min` and `max` bounds
3. **Single or Multiple Values** — Enum-based preferences (`shineFactor`) can accept a single value or an array of acceptable values
4. **Boolean Preferences** — Boolean attributes are matched exactly when specified
5. **Omitted Preferences** — Attributes not included in preferences indicate no preference (any value is acceptable)

### Example

```json
{
  "size": { "min": 5, "max": 10 },
  "weight": { "min": 100 },
  "hasWorm": false,
  "shineFactor": "shiny"
}
```

This preference indicates:
- Fruit size must be between 5 and 10 (inclusive)
- Fruit weight must be at least 100
- Fruit must NOT have a worm
- Fruit must be shiny
- No preference for stem, leaf, or chemicals

---

## Data Files

| File                          | Description                              |
|-------------------------------|------------------------------------------|
| `raw_apples_and_oranges.json` | Seed data for initial fruit population   |

---

## TypeScript Definitions

For convenience, here are some types you can use:

```typescript

export type ShineFactor = "dull" | "neutral" | "shiny" | "extraShiny";

export interface FruitAttributes {
  size: number | null;
  weight: number | null;
  hasStem: boolean | null;
  hasLeaf: boolean | null;
  hasWorm: boolean | null;
  shineFactor: ShineFactor | null;
  hasChemicals: boolean | null;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

export interface FruitPreferences {
  size?: NumberRange;
  weight?: NumberRange;
  hasStem?: boolean;
  hasLeaf?: boolean;
  hasWorm?: boolean;
  shineFactor?: ShineFactor | ShineFactor[];
  hasChemicals?: boolean;
}

export interface Fruit {
  type: "apple" | "orange";
  attributes: FruitAttributes;
  preferences: FruitPreferences;
}

export interface MatchResult {
  appleId: string;
  orangeId: string;
  appleToOrangeScore: number;
  orangeToAppleScore: number;
  mutualScore: number;
  createdAt: string;
}
```

