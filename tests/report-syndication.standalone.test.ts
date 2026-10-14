// Report feeds, llms.txt and agent copy name the same public issues as the web pages.
// A short industry word must not become the product name ("电力日报"), and the all-feed
// title stays the subject phrase ("全部 … 动态").
import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_TITLES, SITE, subjectAfter } from "@aihot/site";
import { agentGuide, dailyAnswer, periodAnswer } from "@aihot/backend/publication/agent";
import { feedMeta, reportFeedItemTitle } from "@aihot/backend/publication/feeds";
import { llmsTxt } from "@aihot/backend/publication/llms";
import { isComposerIssueTitle } from "@aihot/backend/publication/reports";

const SHORT_PRODUCT = /(?<!能源)电力[日周月]报/;
const modules = { api: [], pace: [], pages: [], topics: [], access: [], usage: [], guideClients: [], ways: [] };

test("daily, weekly and monthly feeds use the web report titles", () => {
  assert.equal(feedMeta("all").title, `${SITE.name} — ${subjectAfter("全部", "动态")}`);
  for (const kind of ["daily", "weekly", "monthly"] as const) {
    const bare = kind === "daily" ? "日报" : kind === "weekly" ? "周报" : "月报";
    assert.equal(REPORT_TITLES[kind], `能源电力${bare}`);
    assert.equal(feedMeta(kind).title, REPORT_TITLES[kind]);
    assert.equal(reportFeedItemTitle(kind, "2026-10-14", null), `${REPORT_TITLES[kind]} · 2026-10-14`);
    assert.equal(reportFeedItemTitle(kind, "2026-10-14", "头条"), `${REPORT_TITLES[kind]} · 2026-10-14 — 头条`);
    assert.doesNotMatch(feedMeta(kind).title, SHORT_PRODUCT);
    assert.doesNotMatch(feedMeta(kind).description, SHORT_PRODUCT);
    assert.notEqual(feedMeta(kind).title, `${SITE.name} ${bare}`);
    assert.ok(feedMeta(kind).description.includes(REPORT_TITLES.daily) || kind === "daily");
  }
  assert.match(feedMeta("daily").description, /能源电力行业精编日报/);
  assert.match(feedMeta("weekly").description, /能源电力日报/);
  assert.match(feedMeta("monthly").description, /能源电力日报/);
});

test("llms.txt and the agent guide name reports with REPORT_TITLES", () => {
  const text = llmsTxt({
    hasDailies: true, hasWeekly: true, hasMonthly: true, topics: [], tools: ["sample_tool"], modules,
  });
  const guide = agentGuide();
  for (const body of [text, guide]) {
    for (const title of Object.values(REPORT_TITLES)) assert.match(body, new RegExp(title));
    assert.doesNotMatch(body, SHORT_PRODUCT);
  }
  assert.match(text, /\[能源电力日报 RSS\]/);
  assert.match(text, /\[能源电力周报 RSS\]/);
  assert.match(text, /\[能源电力月报 RSS\]/);
  assert.match(text, /公开 API · 最新能源电力日报/);
  assert.match(text, /公开 API · 最新能源电力周报/);
  assert.match(text, /公开 API · 最新能源电力月报/);
  assert.doesNotMatch(text, /\[日报 RSS\]|\[周报 RSS\]|\[月报 RSS\]/);
  assert.match(text, /\[全部动态\]/);
  assert.match(text, new RegExp(subjectAfter("全量", "资讯流").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("agent answers prefix an issue with the public report name", () => {
  const daily = dailyAnswer({
    date: "2026-10-14",
    windowStart: "2026-10-13T00:00:00.000Z",
    windowEnd: "2026-10-14T00:00:00.000Z",
    links: { aihot: "https://example.test/daily/2026-10-14" },
    lead: null,
    sections: [],
    flashes: [],
  }, "http");
  assert.ok(daily.startsWith(`# ${REPORT_TITLES.daily} · 2026-10-14`));
  assert.match(daily, new RegExp(`${REPORT_TITLES.daily}是每天`));
  assert.doesNotMatch(daily, SHORT_PRODUCT);
  const weekly = periodAnswer({
    week: "2026-W41",
    periodStart: "2026-10-05",
    periodEnd: "2026-10-11",
    links: { aihot: "https://example.test/weekly/2026-W41" },
    headline: null,
    overview: null,
    sections: [],
  }, "weekly", "http");
  assert.ok(weekly.startsWith(`# ${REPORT_TITLES.weekly} · 2026-W41`));
  assert.match(weekly, new RegExp(`从 2026-10-05 至 2026-10-11 的${REPORT_TITLES.daily}里`));
  assert.doesNotMatch(weekly, SHORT_PRODUCT);
});

test("composer issue labels stay issue names, including the older site-name form", () => {
  assert.equal(isComposerIssueTitle(`${SITE.name} 周报 · 2026-W41`), true);
  assert.equal(isComposerIssueTitle(`${SITE.name} 月报 · 2026-10`), true);
  assert.equal(isComposerIssueTitle(`${REPORT_TITLES.weekly} · 2026-W41`), true);
  assert.equal(isComposerIssueTitle(`${REPORT_TITLES.monthly} · 2026-10`), true);
  assert.equal(isComposerIssueTitle("本周最重要的电价调整"), false);
  assert.equal(isComposerIssueTitle(`${SITE.name} 发布了新规定`), false);
});
