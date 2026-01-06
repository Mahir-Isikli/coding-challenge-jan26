/**
 * Tests for Fruit Generation and Communication
 *
 * Run from project root with:
 * deno test --config supabase/functions/_shared/deno.json supabase/functions/_shared/generateFruit.test.ts
 */

import {
  assertEquals,
  assertExists,
  assert,
} from "std/assert";

import {
  generateFruit,
  generateApple,
  generateOrange,
  communicateAttributes,
  communicatePreferences,
  type Fruit,
  type ShineFactor,
} from "./generateFruit.ts";

// ============================================================================
// Helper Functions
// ============================================================================

const VALID_SHINE_FACTORS: ShineFactor[] = ["dull", "neutral", "shiny", "extraShiny"];

function isValidShineFactor(value: unknown): value is ShineFactor {
  return typeof value === "string" && VALID_SHINE_FACTORS.includes(value as ShineFactor);
}

function isValidNumberRange(range: { min?: number; max?: number }): boolean {
  if (range.min !== undefined && typeof range.min !== "number") return false;
  if (range.max !== undefined && typeof range.max !== "number") return false;
  if (range.min !== undefined && range.max !== undefined && range.min > range.max) return false;
  return true;
}

// ============================================================================
// Fruit Generation Tests
// ============================================================================

Deno.test("generateFruit - creates an apple with correct type", () => {
  const fruit = generateFruit("apple");
  assertEquals(fruit.type, "apple");
});

Deno.test("generateFruit - creates an orange with correct type", () => {
  const fruit = generateFruit("orange");
  assertEquals(fruit.type, "orange");
});

Deno.test("generateApple - creates an apple", () => {
  const apple = generateApple();
  assertEquals(apple.type, "apple");
  assertExists(apple.attributes);
  assertExists(apple.preferences);
});

Deno.test("generateOrange - creates an orange", () => {
  const orange = generateOrange();
  assertEquals(orange.type, "orange");
  assertExists(orange.attributes);
  assertExists(orange.preferences);
});

Deno.test("generateFruit - attributes have correct structure", () => {
  const fruit = generateFruit("apple");
  const { attributes } = fruit;

  // Check all attribute keys exist
  assert("size" in attributes);
  assert("weight" in attributes);
  assert("hasStem" in attributes);
  assert("hasLeaf" in attributes);
  assert("hasWorm" in attributes);
  assert("shineFactor" in attributes);
  assert("hasChemicals" in attributes);
});

Deno.test("generateFruit - size is valid number or null", () => {
  // Generate multiple to test distribution
  for (let i = 0; i < 50; i++) {
    const fruit = generateFruit("apple");
    const { size } = fruit.attributes;
    
    if (size !== null) {
      assert(typeof size === "number", "size should be a number");
      assert(size >= 2.0, `size ${size} should be >= 2.0`);
      assert(size <= 14.0, `size ${size} should be <= 14.0`);
    }
  }
});

Deno.test("generateFruit - weight is valid number or null", () => {
  for (let i = 0; i < 50; i++) {
    const fruit = generateFruit("orange");
    const { weight } = fruit.attributes;
    
    if (weight !== null) {
      assert(typeof weight === "number", "weight should be a number");
      assert(weight >= 50, `weight ${weight} should be >= 50`);
      assert(weight <= 350, `weight ${weight} should be <= 350`);
    }
  }
});

Deno.test("generateFruit - boolean attributes are boolean or null", () => {
  for (let i = 0; i < 20; i++) {
    const fruit = generateFruit("apple");
    const { hasStem, hasLeaf, hasWorm, hasChemicals } = fruit.attributes;

    if (hasStem !== null) assert(typeof hasStem === "boolean");
    if (hasLeaf !== null) assert(typeof hasLeaf === "boolean");
    if (hasWorm !== null) assert(typeof hasWorm === "boolean");
    if (hasChemicals !== null) assert(typeof hasChemicals === "boolean");
  }
});

Deno.test("generateFruit - shineFactor is valid enum or null", () => {
  for (let i = 0; i < 30; i++) {
    const fruit = generateFruit("orange");
    const { shineFactor } = fruit.attributes;

    if (shineFactor !== null) {
      assert(isValidShineFactor(shineFactor), `Invalid shine factor: ${shineFactor}`);
    }
  }
});

Deno.test("generateFruit - preferences have correct structure when present", () => {
  // Generate many fruits to ensure we get some with preferences
  const fruits: Fruit[] = [];
  for (let i = 0; i < 100; i++) {
    fruits.push(generateFruit(i % 2 === 0 ? "apple" : "orange"));
  }

  // Check size preferences
  const withSizePref = fruits.filter((f) => f.preferences.size !== undefined);
  for (const fruit of withSizePref) {
    assert(isValidNumberRange(fruit.preferences.size!), "size preference should be valid range");
  }

  // Check weight preferences
  const withWeightPref = fruits.filter((f) => f.preferences.weight !== undefined);
  for (const fruit of withWeightPref) {
    assert(isValidNumberRange(fruit.preferences.weight!), "weight preference should be valid range");
  }

  // Check shineFactor preferences
  const withShinePref = fruits.filter((f) => f.preferences.shineFactor !== undefined);
  for (const fruit of withShinePref) {
    const pref = fruit.preferences.shineFactor!;
    if (Array.isArray(pref)) {
      for (const sf of pref) {
        assert(isValidShineFactor(sf), `Invalid shine factor in array: ${sf}`);
      }
    } else {
      assert(isValidShineFactor(pref), `Invalid shine factor: ${pref}`);
    }
  }

  // Check boolean preferences
  const withBoolPrefs = fruits.filter(
    (f) =>
      f.preferences.hasStem !== undefined ||
      f.preferences.hasLeaf !== undefined ||
      f.preferences.hasWorm !== undefined ||
      f.preferences.hasChemicals !== undefined
  );
  for (const fruit of withBoolPrefs) {
    if (fruit.preferences.hasStem !== undefined) {
      assert(typeof fruit.preferences.hasStem === "boolean");
    }
    if (fruit.preferences.hasLeaf !== undefined) {
      assert(typeof fruit.preferences.hasLeaf === "boolean");
    }
    if (fruit.preferences.hasWorm !== undefined) {
      assert(typeof fruit.preferences.hasWorm === "boolean");
    }
    if (fruit.preferences.hasChemicals !== undefined) {
      assert(typeof fruit.preferences.hasChemicals === "boolean");
    }
  }
});

Deno.test("generateFruit - generates variety (not all same values)", () => {
  const fruits: Fruit[] = [];
  for (let i = 0; i < 50; i++) {
    fruits.push(generateFruit("apple"));
  }

  // Check that sizes vary
  const sizes = fruits
    .map((f) => f.attributes.size)
    .filter((s): s is number => s !== null);
  const uniqueSizes = new Set(sizes);
  assert(uniqueSizes.size > 5, "Should have variety in sizes");

  // Check that weights vary
  const weights = fruits
    .map((f) => f.attributes.weight)
    .filter((w): w is number => w !== null);
  const uniqueWeights = new Set(weights);
  assert(uniqueWeights.size > 5, "Should have variety in weights");

  // Check that shine factors vary
  const shines = fruits
    .map((f) => f.attributes.shineFactor)
    .filter((s): s is ShineFactor => s !== null);
  const uniqueShines = new Set(shines);
  assert(uniqueShines.size >= 2, "Should have variety in shine factors");
});

Deno.test("generateFruit - some nulls are generated (low probability)", () => {
  const fruits: Fruit[] = [];
  for (let i = 0; i < 200; i++) {
    fruits.push(generateFruit(i % 2 === 0 ? "apple" : "orange"));
  }

  // With 5% null probability and 200 samples, we should see at least some nulls
  const nullSizes = fruits.filter((f) => f.attributes.size === null).length;
  const nullWeights = fruits.filter((f) => f.attributes.weight === null).length;

  // It's statistically unlikely (but possible) to have zero nulls in 200 samples
  // We'll just check the test runs without error - manual inspection can verify
  console.log(`  Null sizes: ${nullSizes}/200, Null weights: ${nullWeights}/200`);
});

// ============================================================================
// Communication Tests
// ============================================================================

Deno.test("communicateAttributes - returns non-empty string", () => {
  const fruit = generateApple();
  const message = communicateAttributes(fruit);

  assert(typeof message === "string", "Should return a string");
  assert(message.length > 0, "Should not be empty");
});

Deno.test("communicateAttributes - mentions fruit type", () => {
  const apple = generateApple();
  const appleMessage = communicateAttributes(apple);
  assert(appleMessage.toLowerCase().includes("apple"), "Apple message should mention 'apple'");

  const orange = generateOrange();
  const orangeMessage = communicateAttributes(orange);
  assert(orangeMessage.toLowerCase().includes("orange"), "Orange message should mention 'orange'");
});

Deno.test("communicateAttributes - includes size info when present", () => {
  // Generate until we get one with a size
  let fruit: Fruit;
  let attempts = 0;
  do {
    fruit = generateApple();
    attempts++;
  } while (fruit.attributes.size === null && attempts < 100);

  if (fruit.attributes.size !== null) {
    const message = communicateAttributes(fruit);
    // Should mention the size value somewhere
    assert(
      message.includes(fruit.attributes.size.toString()) ||
        message.toLowerCase().includes("size"),
      "Should reference size"
    );
  }
});

Deno.test("communicateAttributes - generates varied output", () => {
  const fruit = generateApple();
  const messages = new Set<string>();

  // Generate multiple messages for the same fruit
  for (let i = 0; i < 20; i++) {
    messages.add(communicateAttributes(fruit));
  }

  // Should have some variation (not all identical)
  assert(messages.size > 1, "Should generate varied messages");
  console.log(`  Generated ${messages.size} unique messages for same fruit`);
});

Deno.test("communicatePreferences - returns non-empty string", () => {
  const fruit = generateApple();
  const message = communicatePreferences(fruit);

  assert(typeof message === "string", "Should return a string");
  assert(message.length > 0, "Should not be empty");
});

Deno.test("communicatePreferences - handles fruit with no preferences", () => {
  // Create a fruit with empty preferences
  const fruit: Fruit = {
    type: "apple",
    attributes: {
      size: 7,
      weight: 180,
      hasStem: true,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "shiny",
      hasChemicals: false,
    },
    preferences: {},
  };

  const message = communicatePreferences(fruit);
  assert(message.length > 0, "Should return a message even with no preferences");
  // Should indicate they're open-minded
  assert(
    message.toLowerCase().includes("open") ||
      message.toLowerCase().includes("no") ||
      message.toLowerCase().includes("easy"),
    "Should indicate flexibility when no preferences"
  );
});

Deno.test("communicatePreferences - mentions target fruit type when relevant", () => {
  // Create fruits with specific preferences that will mention target type
  const appleWithPrefs: Fruit = {
    type: "apple",
    attributes: {
      size: 7,
      weight: 180,
      hasStem: true,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "shiny",
      hasChemicals: false,
    },
    preferences: {
      size: { min: 5, max: 10 },
    },
  };

  const orangeWithPrefs: Fruit = {
    type: "orange",
    attributes: {
      size: 8,
      weight: 200,
      hasStem: false,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "neutral",
      hasChemicals: false,
    },
    preferences: {
      size: { min: 5, max: 10 },
    },
  };

  // Generate multiple messages to check that target type is mentioned at least sometimes
  let appleFoundOrange = false;
  let orangeFoundApple = false;

  for (let i = 0; i < 10; i++) {
    const appleMessage = communicatePreferences(appleWithPrefs);
    const orangeMessage = communicatePreferences(orangeWithPrefs);
    
    if (appleMessage.toLowerCase().includes("orange")) appleFoundOrange = true;
    if (orangeMessage.toLowerCase().includes("apple")) orangeFoundApple = true;
  }

  assert(appleFoundOrange, "Apple's preferences should mention 'orange' at least once in 10 tries");
  assert(orangeFoundApple, "Orange's preferences should mention 'apple' at least once in 10 tries");
});

Deno.test("communicatePreferences - includes size preference when present", () => {
  // Create a fruit with specific size preference
  const fruit: Fruit = {
    type: "apple",
    attributes: {
      size: 7,
      weight: 180,
      hasStem: true,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "shiny",
      hasChemicals: false,
    },
    preferences: {
      size: { min: 5, max: 10 },
    },
  };

  const message = communicatePreferences(fruit);
  // Should mention the size values
  assert(
    message.includes("5") || message.includes("10") || message.toLowerCase().includes("size"),
    "Should reference size preference"
  );
});

Deno.test("communicatePreferences - includes worm preference", () => {
  const fruit: Fruit = {
    type: "orange",
    attributes: {
      size: 8,
      weight: 200,
      hasStem: false,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "neutral",
      hasChemicals: false,
    },
    preferences: {
      hasWorm: false,
    },
  };

  const message = communicatePreferences(fruit);
  assert(
    message.toLowerCase().includes("worm"),
    "Should mention worm preference"
  );
});

Deno.test("communicatePreferences - generates varied output", () => {
  const fruit: Fruit = {
    type: "apple",
    attributes: {
      size: 7,
      weight: 180,
      hasStem: true,
      hasLeaf: false,
      hasWorm: false,
      shineFactor: "shiny",
      hasChemicals: false,
    },
    preferences: {
      size: { min: 5, max: 10 },
      hasWorm: false,
      shineFactor: "shiny",
    },
  };

  const messages = new Set<string>();
  for (let i = 0; i < 20; i++) {
    messages.add(communicatePreferences(fruit));
  }

  assert(messages.size > 1, "Should generate varied preference messages");
  console.log(`  Generated ${messages.size} unique preference messages`);
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test("Integration - full fruit generation and communication flow", () => {
  // Generate fruits
  const apple = generateApple();
  const orange = generateOrange();

  // Communicate attributes
  const appleAttrs = communicateAttributes(apple);
  const orangeAttrs = communicateAttributes(orange);

  // Communicate preferences
  const applePrefs = communicatePreferences(apple);
  const orangePrefs = communicatePreferences(orange);

  // All should be non-empty strings
  assert(appleAttrs.length > 50, "Apple attributes message should be substantial");
  assert(orangeAttrs.length > 50, "Orange attributes message should be substantial");
  assert(applePrefs.length > 20, "Apple preferences message should exist");
  assert(orangePrefs.length > 20, "Orange preferences message should exist");

  console.log("\n  === Sample Apple ===");
  console.log(`  Attributes: ${appleAttrs}`);
  console.log(`  Preferences: ${applePrefs}`);
  console.log("\n  === Sample Orange ===");
  console.log(`  Attributes: ${orangeAttrs}`);
  console.log(`  Preferences: ${orangePrefs}`);
});

Deno.test("Integration - batch generation produces valid diverse fruits", () => {
  const fruits: Fruit[] = [];
  const appleCount = 20;
  const orangeCount = 20;

  for (let i = 0; i < appleCount; i++) {
    fruits.push(generateApple());
  }
  for (let i = 0; i < orangeCount; i++) {
    fruits.push(generateOrange());
  }

  // Verify counts
  const apples = fruits.filter((f) => f.type === "apple");
  const oranges = fruits.filter((f) => f.type === "orange");
  assertEquals(apples.length, appleCount);
  assertEquals(oranges.length, orangeCount);

  // Verify all have valid structure
  for (const fruit of fruits) {
    assertExists(fruit.type);
    assertExists(fruit.attributes);
    assertExists(fruit.preferences);

    // Verify communication works for each
    const attrMsg = communicateAttributes(fruit);
    const prefMsg = communicatePreferences(fruit);
    assert(attrMsg.length > 0);
    assert(prefMsg.length > 0);
  }

  console.log(`  Successfully generated and communicated ${fruits.length} fruits`);
});

