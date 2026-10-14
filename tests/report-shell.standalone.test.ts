// Empty weekly and monthly placeholders stay out of discovery. Failure cases: a quiet daily, a period
// that still cites stories (including after withdrawal), or a non-zero story count is treated as a shell.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPlaceholderReport } from "@aihot/backend/publication/report-shell";
import { periodShellCopy } from "@aihot/site";

const liveMonthly = {
  title: "能源电力热榜 月报 · 2026-09",
  headline: "本期无可用日报数据",
  overview: "站点上线前无 9 月日报，已跳过自动汇编（运维占位，避免每 30 分钟重试）。",
  highlights: [],
  themes: [],
  storyOrder: [],
  metrics: { totalStories: 0, selectedCount: 0, reportsCovered: 0 },
};

const liveWeekly = {
  title: "能源电力热榜 周报 · 2026-W40",
  headline: "本期无可用日报数据",
  overview: "本期无可用日报数据",
  highlights: [],
  themes: [],
  storyOrder: [],
  metrics: { totalStories: 0, selectedCount: 0, reportsCovered: 0 },
};

test("the live empty monthly and weekly W40 are placeholders without hardcoding their periods", () => {
  assert.equal(isPlaceholderReport("monthly", liveMonthly), true);
  assert.equal(isPlaceholderReport("weekly", liveWeekly), true);
});

test("zero stories and zero metrics are a shell even without the ops sentence", () => {
  assert.equal(isPlaceholderReport("monthly", {}), true);
  assert.equal(isPlaceholderReport("weekly", { metrics: { totalStories: 0, selectedCount: 0, reportsCovered: 0 } }), true);
});

test("an explicit skip flag marks an empty period, including one under generator", () => {
  assert.equal(isPlaceholderReport("monthly", { placeholder: true, metrics: { totalStories: 3 } }), true);
  assert.equal(isPlaceholderReport("weekly", { generator: { skipped: "true" }, metrics: { totalStories: 4, selectedCount: 1, reportsCovered: 2 } }), true);
});

test("placeholder wording marks an empty period whose metrics are not zero", () => {
  assert.equal(isPlaceholderReport("monthly", { overview: "已跳过自动汇编", metrics: { totalStories: 2, selectedCount: 1, reportsCovered: 1 } }), true);
});

test("a compiled period that still cites stories is not a shell", () => {
  const compiled = {
    headline: "广西售电陷生存困局",
    leadItemId: "item-1",
    highlights: ["item-2"],
    storyOrder: ["item-1", "item-2"],
    themes: [{ heading: "市场", storyRefs: [{ itemId: "item-1", title: "广西售电陷生存困局" }] }],
    overview: "本月电力市场持续承压。",
    metrics: { totalStories: 20, selectedCount: 28, reportsCovered: 3 },
  };
  assert.equal(isPlaceholderReport("monthly", compiled), false);
  assert.equal(isPlaceholderReport("weekly", { themes: [{ heading: "新闻", storyRefs: [{ title: "仍在" }] }], metrics: { totalStories: 0 } }), false);
  assert.equal(isPlaceholderReport("monthly", { sections: [{ label: "新闻", items: [{ title: "仍在" }] }], overview: "本期无可用日报数据", metrics: { totalStories: 0 } }), false);
  assert.equal(isPlaceholderReport("weekly", { placeholder: true, storyOrder: ["kept-after-withdrawal"], metrics: { totalStories: 0 } }), false);
});

test("a daily is never a placeholder, including a quiet day with no entries", () => {
  assert.equal(isPlaceholderReport("daily", { lead: { title: "今日安静，无大事发生" }, metrics: { totalEvents: 0 }, sections: [] }), false);
  assert.equal(isPlaceholderReport("daily", liveMonthly), false);
});

test("the public wait copy does not repeat the ops placeholder", () => {
  for (const kind of ["weekly", "monthly"] as const) {
    const copy = periodShellCopy(kind);
    assert.match(copy.title, /这一期还没有/);
    assert.match(copy.paragraph, /下一期会在有/);
    assert.doesNotMatch(`${copy.title}\n${copy.paragraph}`, /无可用日报|运维占位|跳过自动汇编/);
  }
});
