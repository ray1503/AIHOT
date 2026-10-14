// Homepage and /all chips are the industry categories. Dead AI slugs must not be offered: production
// answers 400 for them, while the power slugs below are the ones the feed already publishes.
import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@aihot/contracts/taxonomy";

const DEAD = ["ai-models", "ai-products", "industry", "paper", "tip", "opinion"] as const;
const LIVE = ["policy", "market", "grid", "new-energy", "coal-power", "nuclear-hydro", "nuclear", "tech", "safety", "corporate", "commentary"] as const;

test("home filter categories are the live power slugs, not the AI template", () => {
  const keys = CATEGORY_KEYS as readonly string[];
  for (const slug of DEAD) assert.equal(keys.includes(slug), false, slug);
  assert.deepEqual([...CATEGORY_KEYS], [...LIVE]);
  for (const key of LIVE) assert.equal(typeof CATEGORY_LABELS[key], "string");
});
