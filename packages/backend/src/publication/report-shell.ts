// An empty weekly or monthly saved only to hold its period key. The row stays (the scheduler treats a
// missing key as work and would fail the period on every run), but it is not a compiled issue: indexes,
// feeds and discovery leave it out, and its page says so. Dailies are never shells, including a quiet
// day the editors judged with nothing new.
//
// A period report is a shell when it cites no stories and any of these is true:
// - an explicit boolean (or the string "true") on `placeholder`, `shell` or `skipped`, on the content
//   object or under `generator`;
// - `metrics.totalStories`, `selectedCount` and `reportsCovered` are all missing or zero;
// - `headline`, `title`, `overview` or `lead` matches the ops placeholder wording (无可用日报, 运维占位,
//   跳过自动汇编).
// A report that still cites stories (storyOrder, highlights, leadItemId, theme storyRefs or section
// items), including one whose citations were later withdrawn, is a real issue.
import { cached } from "../lib/cache.ts";
import { sql } from "../db.ts";

const FLAGS = ["placeholder", "shell", "skipped"] as const;
const METRICS = ["totalStories", "selectedCount", "reportsCovered"] as const;
const PLACEHOLDER_WORDING = /无可用日报|运维占位|跳过自动汇编/;

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function flagged(value: unknown): boolean {
  return value === true || value === "true";
}

/** Whether the stored content still names stories, withdrawn or not. */
export function periodCitesStories(content: Record<string, any>): boolean {
  if (content.leadItemId) return true;
  if (list(content.highlights).length > 0 || list(content.storyOrder).length > 0) return true;
  if (list(content.themes).some((theme) => list((theme as { storyRefs?: unknown })?.storyRefs).length > 0)) return true;
  if (list(content.sections).some((section) => list((section as { items?: unknown })?.items).length > 0)) return true;
  return false;
}

function explicitSkip(content: Record<string, any>): boolean {
  const generator = content.generator && typeof content.generator === "object" ? content.generator as Record<string, unknown> : {};
  return FLAGS.some((flag) => flagged(content[flag]) || flagged(generator[flag]));
}

function zeroMetrics(content: Record<string, any>): boolean {
  const metrics = content.metrics && typeof content.metrics === "object" ? content.metrics as Record<string, unknown> : {};
  return METRICS.every((key) => {
    const n = Number(metrics[key]);
    return !Number.isFinite(n) || n === 0;
  });
}

function placeholderWording(content: Record<string, any>): boolean {
  const lead = content.lead && typeof content.lead === "object" ? content.lead as Record<string, unknown> : {};
  const text = [content.headline, content.title, content.overview, lead.title, lead.leadParagraph]
    .filter((part): part is string => typeof part === "string")
    .join("\n");
  return PLACEHOLDER_WORDING.test(text);
}

/**
 * Whether this stored report is an empty weekly or monthly placeholder. `kind` is the row's kind, not
 * a field inside the JSON: a daily is never a placeholder.
 */
export function isPlaceholderReport(kind: string, content: unknown): boolean {
  if (kind !== "weekly" && kind !== "monthly") return false;
  if (!content || typeof content !== "object" || Array.isArray(content)) return true;
  const report = content as Record<string, any>;
  if (periodCitesStories(report)) return false;
  return explicitSkip(report) || zeroMetrics(report) || placeholderWording(report);
}

const placeholderKeyCache = {
  weekly: cached(() => loadPlaceholderKeys("weekly"), { freshMs: 60_000, maxStaleMs: 60_000 }),
  monthly: cached(() => loadPlaceholderKeys("monthly"), { freshMs: 60_000, maxStaleMs: 60_000 }),
};

async function loadPlaceholderKeys(kind: "weekly" | "monthly"): Promise<string[]> {
  const rows = await sql<{ key: string; content: unknown }[]>`SELECT key, content FROM reports WHERE kind = ${kind}`;
  return rows.filter((row) => isPlaceholderReport(kind, row.content)).map((row) => row.key);
}

/** Keys of empty period placeholders. Kept with the report index, for a minute. */
export function placeholderKeys(kind: "weekly" | "monthly"): Promise<string[]> {
  return placeholderKeyCache[kind].get();
}

/** SQL fragment that drops those keys. Empty when there is nothing to drop (dailies, or no shells). */
export function hidePlaceholderKeys(column: ReturnType<typeof sql>, keys: string[]) {
  return keys.length ? sql`AND ${column} <> ALL(${keys}::text[])` : sql``;
}
