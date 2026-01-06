/**
 * Fruit Generation Utilities
 *
 * Generates random fruits with normally distributed attributes
 * and reasonably relaxed preferences.
 */

// ============================================================================
// Types
// ============================================================================

export type FruitType = "apple" | "orange";
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
  type: FruitType;
  attributes: FruitAttributes;
  preferences: FruitPreferences;
}

// ============================================================================
// Constants
// ============================================================================

const SHINE_FACTORS: ShineFactor[] = ["dull", "neutral", "shiny", "extraShiny"];

// Distribution parameters for attributes
const SIZE_MEAN = 7.0;
const SIZE_STD_DEV = 2.0;
const SIZE_MIN = 2.0;
const SIZE_MAX = 14.0;

const WEIGHT_MEAN = 180;
const WEIGHT_STD_DEV = 50;
const WEIGHT_MIN = 50;
const WEIGHT_MAX = 350;

// Probability of each attribute being null (unknown)
const NULL_PROBABILITY = 0.05;

// ============================================================================
// Random Utilities
// ============================================================================

/**
 * Generates a random number from a normal distribution using Box-Muller transform
 */
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Generates a normally distributed value clamped to a range
 */
function randomNormalClamped(
  mean: number,
  stdDev: number,
  min: number,
  max: number
): number {
  const value = randomNormal(mean, stdDev);
  return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
}

/**
 * Returns true with the given probability
 */
function randomChance(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Picks a random element from an array
 */
function randomPick<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Picks multiple random elements from an array (no duplicates)
 */
function randomPickMultiple<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

// ============================================================================
// Attribute Generation
// ============================================================================

/**
 * Generates random attributes for a fruit
 */
function generateAttributes(type: FruitType): FruitAttributes {
  // Apples are slightly smaller on average
  const sizeMean = type === "apple" ? SIZE_MEAN - 0.5 : SIZE_MEAN + 0.5;
  const weightMean = type === "apple" ? WEIGHT_MEAN - 10 : WEIGHT_MEAN + 10;

  return {
    size: randomChance(NULL_PROBABILITY)
      ? null
      : randomNormalClamped(sizeMean, SIZE_STD_DEV, SIZE_MIN, SIZE_MAX),

    weight: randomChance(NULL_PROBABILITY)
      ? null
      : randomNormalClamped(weightMean, WEIGHT_STD_DEV, WEIGHT_MIN, WEIGHT_MAX),

    // Apples more likely to have stems
    hasStem: randomChance(NULL_PROBABILITY)
      ? null
      : type === "apple"
        ? randomChance(0.7)
        : randomChance(0.1),

    // Leaves are relatively rare
    hasLeaf: randomChance(NULL_PROBABILITY)
      ? null
      : randomChance(0.25),

    // Worms are rare
    hasWorm: randomChance(NULL_PROBABILITY)
      ? null
      : randomChance(0.08),

    // Shine factor with weighted distribution (neutral/shiny more common)
    shineFactor: randomChance(NULL_PROBABILITY)
      ? null
      : randomPick([
          "dull",
          "neutral",
          "neutral",
          "shiny",
          "shiny",
          "shiny",
          "extraShiny",
        ] as ShineFactor[]),

    // Chemicals somewhat common in commercial fruit
    hasChemicals: randomChance(NULL_PROBABILITY)
      ? null
      : randomChance(0.35),
  };
}

// ============================================================================
// Preference Generation
// ============================================================================

/**
 * Generates relaxed preferences for a fruit
 * Not all preferences are specified, and ranges are generous
 */
function generatePreferences(attributes: FruitAttributes): FruitPreferences {
  const preferences: FruitPreferences = {};

  // ~40% chance to have a size preference (generous range)
  if (randomChance(0.4) && attributes.size !== null) {
    const margin = randomNormalClamped(2.5, 1.0, 1.5, 5.0);
    const preferredSize = attributes.size + randomNormal(0, 1);

    // Sometimes only min, sometimes only max, sometimes both
    const rangeType = randomPick(["both", "min", "max"]);
    if (rangeType === "both" || rangeType === "min") {
      preferences.size = {
        ...preferences.size,
        min: Math.round(Math.max(SIZE_MIN, preferredSize - margin) * 10) / 10,
      };
    }
    if (rangeType === "both" || rangeType === "max") {
      preferences.size = {
        ...preferences.size,
        max: Math.round(Math.min(SIZE_MAX, preferredSize + margin) * 10) / 10,
      };
    }
  }

  // ~35% chance to have a weight preference (generous range)
  if (randomChance(0.35) && attributes.weight !== null) {
    const margin = randomNormalClamped(40, 15, 20, 80);
    const preferredWeight = attributes.weight + randomNormal(0, 20);

    const rangeType = randomPick(["both", "min", "max"]);
    if (rangeType === "both" || rangeType === "min") {
      preferences.weight = {
        ...preferences.weight,
        min: Math.round(Math.max(WEIGHT_MIN, preferredWeight - margin)),
      };
    }
    if (rangeType === "both" || rangeType === "max") {
      preferences.weight = {
        ...preferences.weight,
        max: Math.round(Math.min(WEIGHT_MAX, preferredWeight + margin)),
      };
    }
  }

  // ~25% chance to care about stem
  if (randomChance(0.25)) {
    preferences.hasStem = randomChance(0.6); // Slight preference for stems
  }

  // ~20% chance to care about leaf
  if (randomChance(0.2)) {
    preferences.hasLeaf = randomChance(0.5);
  }

  // ~60% chance to not want a worm (common preference)
  if (randomChance(0.6)) {
    preferences.hasWorm = false;
  }

  // ~45% chance to have shine preference (often multiple acceptable values)
  if (randomChance(0.45)) {
    const numAcceptable = randomPick([1, 2, 2, 3]); // Usually 2 acceptable values
    if (numAcceptable === 1) {
      preferences.shineFactor = randomPick(SHINE_FACTORS);
    } else {
      preferences.shineFactor = randomPickMultiple(SHINE_FACTORS, numAcceptable);
    }
  }

  // ~40% chance to prefer no chemicals
  if (randomChance(0.4)) {
    preferences.hasChemicals = randomChance(0.2); // Most prefer no chemicals
  }

  return preferences;
}

// ============================================================================
// Communication Templates
// ============================================================================

// Greetings and introductions
const ATTRIBUTE_INTROS = [
  "Let me tell you a bit about myself.",
  "Here's what you should know about me.",
  "Allow me to introduce myself.",
  "So, about me...",
  "I'd like to share a few things about who I am.",
  "Let me paint you a picture of myself.",
  "Here's the rundown on yours truly.",
  "Getting to know me? Here goes.",
  "Time for a little self-description.",
  "Let me give you the lowdown on me.",
];

const PREFERENCE_INTROS = [
  "Now, here's what I'm looking for in a match.",
  "As for what I want in a partner...",
  "Let me tell you what catches my eye.",
  "Here's my wish list for the perfect match.",
  "What am I looking for? Well...",
  "In terms of preferences, here's the deal.",
  "My ideal match would be...",
  "Let me share what I find attractive.",
  "Here's what would make my heart skip a beat.",
  "As for my type...",
];

// Size descriptions
const SIZE_DESCRIPTORS: Record<string, string[]> = {
  tiny: ["quite petite", "on the smaller side", "compact", "delightfully tiny", "pocket-sized"],
  small: ["fairly small", "modest in size", "not too big", "pleasantly compact", "a bit on the small side"],
  medium: ["average-sized", "medium-sized", "pretty standard", "right in the middle size-wise", "neither big nor small"],
  large: ["on the larger side", "fairly big", "quite sizeable", "generously proportioned", "pretty large"],
  huge: ["quite large", "impressively big", "on the bigger end", "substantial in size", "rather hefty"],
};

function getSizeCategory(size: number): string {
  if (size < 4) return "tiny";
  if (size < 6) return "small";
  if (size < 8) return "medium";
  if (size < 10) return "large";
  return "huge";
}

// Weight descriptions
const WEIGHT_DESCRIPTORS: Record<string, string[]> = {
  light: ["lightweight", "light as can be", "not too heavy", "pleasantly light", "easy to carry"],
  medium: ["average weight", "middle-of-the-road weight-wise", "neither light nor heavy", "pretty standard weight"],
  heavy: ["on the heavier side", "got some good weight to me", "pretty substantial", "nice and hefty", "solidly weighted"],
};

function getWeightCategory(weight: number): string {
  if (weight < 120) return "light";
  if (weight < 220) return "medium";
  return "heavy";
}

// Shine descriptions
const SHINE_DESCRIPTORS: Record<ShineFactor, string[]> = {
  dull: [
    "I've got a matte finish",
    "my skin has a subtle, understated look",
    "I'm not the shiniest fruit around",
    "I have more of a natural, muted appearance",
    "my surface is pretty low-key",
  ],
  neutral: [
    "I have a nice balanced sheen",
    "my skin has a pleasant, natural glow",
    "I'm neither too shiny nor too dull",
    "I've got that classic fruit appearance",
    "my look is pretty standard",
  ],
  shiny: [
    "I've got a lovely shine to me",
    "my skin really catches the light",
    "I'm pretty polished-looking",
    "I have a nice glossy appearance",
    "you could say I'm quite the looker",
  ],
  extraShiny: [
    "I absolutely gleam",
    "my skin is practically mirror-like",
    "I'm incredibly polished",
    "I shine like nobody's business",
    "I'm basically sparkling over here",
  ],
};

// Boolean attribute templates
const STEM_TEMPLATES = {
  true: [
    "I've still got my stem attached",
    "my stem is intact",
    "I'm proudly sporting my original stem",
    "yes, I come with a stem",
    "my stem is still there, thank you very much",
  ],
  false: [
    "I don't have a stem",
    "my stem's gone",
    "stemless, that's me",
    "no stem on this one",
    "I lost my stem somewhere along the way",
  ],
};

const LEAF_TEMPLATES = {
  true: [
    "I've got a lovely leaf",
    "there's a leaf attached to me",
    "I come with a decorative leaf",
    "my leaf is still there",
    "I'm rocking a leaf",
  ],
  false: [
    "no leaf on me",
    "I'm leafless",
    "the leaf is missing",
    "I don't have a leaf",
    "leaf? nope, not me",
  ],
};

const WORM_TEMPLATES = {
  true: [
    "I'll be honest... there's a worm situation",
    "so, there's a tiny tenant living in me",
    "I come with a small friend inside",
    "yes, I have a worm, don't judge",
    "I'm hosting a little worm",
  ],
  false: [
    "completely worm-free",
    "no worms here",
    "I'm clean inside",
    "absolutely no unwanted guests",
    "worm-free and proud of it",
  ],
};

const CHEMICALS_TEMPLATES = {
  true: [
    "I've been treated with some chemicals",
    "I'm not organic, if that matters",
    "there are some pesticides involved",
    "I've had the chemical treatment",
    "full disclosure: I'm chemically treated",
  ],
  false: [
    "I'm chemical-free",
    "all natural, no chemicals",
    "completely untreated",
    "no pesticides or chemicals on me",
    "I'm as natural as they come",
  ],
};

// Connectors for flowing text
const CONNECTORS = [
  "Also,",
  "And",
  "Plus,",
  "Oh, and",
  "Additionally,",
  "I should mention,",
  "Furthermore,",
  "On top of that,",
  "",
  "",
  "",
];

const PREFERENCE_CONNECTORS = [
  "I'd really like",
  "I'm hoping for",
  "Ideally,",
  "I'd prefer",
  "It would be nice if",
  "I'm drawn to",
  "I tend to go for",
  "I appreciate",
  "I'm looking for",
  "I value",
];

// ============================================================================
// Communication Functions
// ============================================================================

/**
 * Generates a human-readable description of a fruit's attributes
 */
export function communicateAttributes(fruit: Fruit): string {
  const { attributes, type } = fruit;
  const parts: string[] = [];

  // Add intro
  parts.push(randomPick(ATTRIBUTE_INTROS));

  // Type intro
  const typeIntros = [
    `I'm an ${type}, by the way.`,
    `First off, I'm an ${type}.`,
    `So I'm an ${type}.`,
    `As you might have guessed, I'm an ${type}.`,
    `I'm a proud ${type}.`,
  ];
  parts.push(randomPick(typeIntros));

  // Size description
  if (attributes.size !== null) {
    const category = getSizeCategory(attributes.size);
    const descriptor = randomPick(SIZE_DESCRIPTORS[category]);
    const sizeTemplates = [
      `I'm ${descriptor} – about ${attributes.size} units if you want to get technical.`,
      `Size-wise, I'm ${descriptor}. My measurements come in at around ${attributes.size}.`,
      `In terms of size, I'd say I'm ${descriptor} (${attributes.size} units, to be precise).`,
      `I measure about ${attributes.size} units, which makes me ${descriptor}.`,
    ];
    parts.push(randomPick(sizeTemplates));
  } else {
    const unknownSize = [
      "I'm not entirely sure about my exact size, to be honest.",
      "My size? That's a bit of a mystery even to me.",
      "I haven't been measured, so I can't tell you my size.",
    ];
    parts.push(randomPick(unknownSize));
  }

  // Weight description
  if (attributes.weight !== null) {
    const category = getWeightCategory(attributes.weight);
    const descriptor = randomPick(WEIGHT_DESCRIPTORS[category]);
    const connector = randomPick(CONNECTORS);
    const weightTemplates = [
      `${connector} I weigh about ${attributes.weight} grams – ${descriptor}.`,
      `${connector} weight-wise, I'm ${descriptor}, coming in at ${attributes.weight}g.`,
      `${connector} I tip the scales at ${attributes.weight} grams. Pretty ${descriptor}.`,
      `${connector} at ${attributes.weight} grams, I'm ${descriptor}.`,
    ];
    parts.push(randomPick(weightTemplates).trim());
  } else if (randomChance(0.5)) {
    parts.push("Not sure about my weight though.");
  }

  // Shine factor
  if (attributes.shineFactor !== null) {
    const connector = randomPick(CONNECTORS);
    const shineDesc = randomPick(SHINE_DESCRIPTORS[attributes.shineFactor]);
    parts.push(`${connector} ${shineDesc}.`.trim());
  }

  // Stem
  if (attributes.hasStem !== null) {
    const connector = randomPick(CONNECTORS);
    const stemDesc = randomPick(STEM_TEMPLATES[attributes.hasStem.toString() as "true" | "false"]);
    parts.push(`${connector} ${stemDesc}.`.trim());
  }

  // Leaf (sometimes skip if no leaf for brevity)
  if (attributes.hasLeaf !== null && (attributes.hasLeaf || randomChance(0.5))) {
    const connector = randomPick(CONNECTORS);
    const leafDesc = randomPick(LEAF_TEMPLATES[attributes.hasLeaf.toString() as "true" | "false"]);
    parts.push(`${connector} ${leafDesc}.`.trim());
  }

  // Worm (always mention if true, sometimes mention if false)
  if (attributes.hasWorm !== null) {
    if (attributes.hasWorm || randomChance(0.4)) {
      const connector = randomPick(CONNECTORS);
      const wormDesc = randomPick(WORM_TEMPLATES[attributes.hasWorm.toString() as "true" | "false"]);
      parts.push(`${connector} ${wormDesc}.`.trim());
    }
  }

  // Chemicals
  if (attributes.hasChemicals !== null && randomChance(0.7)) {
    const connector = randomPick(CONNECTORS);
    const chemDesc = randomPick(CHEMICALS_TEMPLATES[attributes.hasChemicals.toString() as "true" | "false"]);
    parts.push(`${connector} ${chemDesc}.`.trim());
  }

  // Add a closing sometimes
  if (randomChance(0.4)) {
    const closings = [
      "That's me in a nutshell!",
      "So that's the story of me.",
      "And that's who I am.",
      "That pretty much covers it.",
      "Anyway, that's me!",
    ];
    parts.push(randomPick(closings));
  }

  return parts.join(" ");
}

/**
 * Generates a human-readable description of a fruit's preferences
 */
export function communicatePreferences(fruit: Fruit): string {
  const { preferences, type } = fruit;
  const parts: string[] = [];
  const otherType = type === "apple" ? "orange" : "apple";

  // Check if there are any preferences at all
  const hasPrefs = Object.keys(preferences).length > 0;

  if (!hasPrefs) {
    const openMinded = [
      `Honestly? I'm pretty open-minded about my ${otherType} match. No strict requirements here.`,
      `I don't have many specific preferences. I'm open to meeting all kinds of ${otherType}s.`,
      `I'm easy-going when it comes to preferences. Surprise me!`,
      `I believe in keeping an open mind. Any ${otherType} could be the one.`,
      `No particular preferences here – I like to keep my options open.`,
    ];
    return randomPick(openMinded);
  }

  // Add intro
  parts.push(randomPick(PREFERENCE_INTROS));

  // Size preferences
  if (preferences.size) {
    const { min, max } = preferences.size;
    const connector = randomPick(PREFERENCE_CONNECTORS);
    let sizeDesc: string;

    if (min !== undefined && max !== undefined) {
      const sizeTemplates = [
        `${connector} an ${otherType} that's between ${min} and ${max} in size.`,
        `${connector} someone sized around ${min} to ${max}.`,
        `size matters to me – ideally between ${min} and ${max}.`,
        `I'm into ${otherType}s in the ${min}-${max} size range.`,
      ];
      sizeDesc = randomPick(sizeTemplates);
    } else if (min !== undefined) {
      const sizeTemplates = [
        `${connector} an ${otherType} that's at least ${min} in size.`,
        `${connector} someone who's not too small – ${min} or bigger.`,
        `I like my ${otherType}s at least ${min} in size.`,
        `size-wise, ${min}+ would be ideal.`,
      ];
      sizeDesc = randomPick(sizeTemplates);
    } else if (max !== undefined) {
      const sizeTemplates = [
        `${connector} an ${otherType} no bigger than ${max}.`,
        `${connector} someone on the smaller side – max ${max}.`,
        `I prefer ${otherType}s that are ${max} or smaller.`,
        `not too big – ${max} max for me.`,
      ];
      sizeDesc = randomPick(sizeTemplates);
    } else {
      sizeDesc = "";
    }
    if (sizeDesc) parts.push(sizeDesc);
  }

  // Weight preferences
  if (preferences.weight) {
    const { min, max } = preferences.weight;
    const connector = randomPick(PREFERENCE_CONNECTORS);
    let weightDesc: string;

    if (min !== undefined && max !== undefined) {
      const templates = [
        `${connector} weight in the ${min}g to ${max}g range.`,
        `${connector} an ${otherType} weighing between ${min} and ${max} grams.`,
        `weight-wise, I'm looking at ${min}-${max}g.`,
        `I like ${otherType}s that weigh somewhere between ${min} and ${max}.`,
      ];
      weightDesc = randomPick(templates);
    } else if (min !== undefined) {
      const templates = [
        `${connector} someone with a bit of heft – at least ${min}g.`,
        `${connector} an ${otherType} that's at least ${min} grams.`,
        `I appreciate some substance – ${min}g minimum.`,
        `don't be too light – ${min}g or more is nice.`,
      ];
      weightDesc = randomPick(templates);
    } else if (max !== undefined) {
      const templates = [
        `${connector} someone on the lighter side – under ${max}g.`,
        `${connector} an ${otherType} no heavier than ${max} grams.`,
        `I prefer lighter ${otherType}s – ${max}g max.`,
        `not too heavy, please – ${max}g or less.`,
      ];
      weightDesc = randomPick(templates);
    } else {
      weightDesc = "";
    }
    if (weightDesc) parts.push(weightDesc);
  }

  // Stem preference
  if (preferences.hasStem !== undefined) {
    const connector = randomPick(PREFERENCE_CONNECTORS);
    const stemPrefs = preferences.hasStem
      ? [
          `${connector} an ${otherType} with a stem still attached.`,
          `a stem is important to me.`,
          `I find stems attractive, honestly.`,
          `${connector} ${otherType}s that have kept their stem.`,
        ]
      : [
          `${connector} an ${otherType} without a stem.`,
          `stems aren't really my thing.`,
          `I prefer stemless, actually.`,
          `${connector} ${otherType}s that don't have a stem.`,
        ];
    parts.push(randomPick(stemPrefs));
  }

  // Leaf preference
  if (preferences.hasLeaf !== undefined) {
    const connector = randomPick(PREFERENCE_CONNECTORS);
    const leafPrefs = preferences.hasLeaf
      ? [
          `${connector} an ${otherType} with a leaf – it's a nice touch.`,
          `leaves are charming to me.`,
          `I'm drawn to ${otherType}s with leaves.`,
          `a leaf would be lovely.`,
        ]
      : [
          `${connector} an ${otherType} without a leaf.`,
          `leaves aren't necessary for me.`,
          `no leaf needed.`,
          `I don't really care for leaves.`,
        ];
    parts.push(randomPick(leafPrefs));
  }

  // Worm preference (almost always "no worm")
  if (preferences.hasWorm !== undefined) {
    if (!preferences.hasWorm) {
      const noWormPrefs = [
        "And please, no worms. That's a dealbreaker.",
        "Definitely no worms – that's non-negotiable.",
        "Worm-free is a must for me.",
        "I'd really rather not deal with any worm situations.",
        "No worms, please. I have standards.",
      ];
      parts.push(randomPick(noWormPrefs));
    } else {
      // Rare case where they want a worm
      parts.push("Surprisingly, I don't mind a worm. It adds character.");
    }
  }

  // Shine preference
  if (preferences.shineFactor !== undefined) {
    const connector = randomPick(PREFERENCE_CONNECTORS);
    const shinePrefs = Array.isArray(preferences.shineFactor)
      ? preferences.shineFactor
      : [preferences.shineFactor];

    const shineLabels: Record<ShineFactor, string> = {
      dull: "matte/dull",
      neutral: "naturally finished",
      shiny: "shiny",
      extraShiny: "extra shiny",
    };

    if (shinePrefs.length === 1) {
      const templates = [
        `${connector} an ${otherType} that's ${shineLabels[shinePrefs[0]]}.`,
        `I'm into the ${shineLabels[shinePrefs[0]]} look.`,
        `${shineLabels[shinePrefs[0]]} is my aesthetic preference.`,
        `I find ${shineLabels[shinePrefs[0]]} ${otherType}s most attractive.`,
      ];
      parts.push(randomPick(templates));
    } else {
      const labels = shinePrefs.map((s) => shineLabels[s]).join(" or ");
      const templates = [
        `${connector} an ${otherType} that's ${labels}.`,
        `I'm fine with ${labels} finishes.`,
        `${labels} – any of those work for me.`,
        `appearance-wise, ${labels} would be great.`,
      ];
      parts.push(randomPick(templates));
    }
  }

  // Chemical preference
  if (preferences.hasChemicals !== undefined) {
    const connector = randomPick(PREFERENCE_CONNECTORS);
    const chemPrefs = preferences.hasChemicals
      ? [
          `${connector} I don't mind if they've been chemically treated.`,
          `chemical treatment doesn't bother me.`,
          `I'm okay with non-organic.`,
        ]
      : [
          `${connector} I'd prefer someone chemical-free.`,
          `organic is important to me.`,
          `no chemicals, please – I care about that.`,
          `I'm looking for an all-natural ${otherType}.`,
        ];
    parts.push(randomPick(chemPrefs));
  }

  // Add a closing sometimes
  if (randomChance(0.5)) {
    const closings = [
      "But hey, I'm flexible on most of this.",
      "That's my ideal, anyway.",
      "Of course, chemistry matters most in the end!",
      "But I'm open to being surprised.",
      "Those are my main criteria, at least.",
      `Here's hoping the right ${otherType} is out there for me!`,
    ];
    parts.push(randomPick(closings));
  }

  return parts.join(" ");
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generates a random fruit of the specified type
 *
 * @param type - The type of fruit to generate ("apple" or "orange")
 * @returns A randomly generated fruit with attributes and preferences
 */
export function generateFruit(type: FruitType): Fruit {
  const attributes = generateAttributes(type);
  const preferences = generatePreferences(attributes);

  return {
    type,
    attributes,
    preferences,
  };
}

/**
 * Generates a random apple
 */
export function generateApple(): Fruit {
  return generateFruit("apple");
}

/**
 * Generates a random orange
 */
export function generateOrange(): Fruit {
  return generateFruit("orange");
}

