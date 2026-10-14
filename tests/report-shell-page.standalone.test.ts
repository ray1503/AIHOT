/// <reference lib="dom" />
// An empty monthly placeholder is not offered as a compiled issue. Failure cases: the latest page or
// the stable detail URL still prints the ops headline, omits noindex, or a real weekly becomes noindex.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import * as cheerio from "cheerio";
import type { ReportDetail } from "@aihot/contracts/site";
import { periodShellCopy, REPORT_TITLES, SITE } from "@aihot/site";
import { startWebServer, type WebServer } from "../apps/web/tests/web-server.ts";

const at = "2026-10-09T12:18:31.828Z";
const shell: ReportDetail = {
  kind: "monthly", key: "2026-09", issueNumber: 0, title: `${REPORT_TITLES.monthly} 2026-09`, generatedAt: at,
  lead: null, leadItemId: null, overview: null, highlights: [], sections: [], flashes: [], cover: null,
  metrics: { totalStories: 0, selectedCount: 0, reportsCovered: 0 }, readingMinutes: 1, prev: null, next: null, shell: true,
};
const weeklyShell: ReportDetail = {
  kind: "weekly", key: "2026-W40", issueNumber: 0, title: `${REPORT_TITLES.weekly} 2026-W40`, generatedAt: at,
  lead: null, leadItemId: null, overview: null, highlights: [], sections: [], flashes: [], cover: null,
  metrics: { totalStories: 0, selectedCount: 0, reportsCovered: 0 }, readingMinutes: 1, prev: null, next: null, shell: true,
};
const weekly: ReportDetail = {
  kind: "weekly", key: "2026-W41", issueNumber: 1, title: `${SITE.name} 周报 · 2026-W41`, generatedAt: at,
  lead: { title: "广西售电陷生存困局", leadParagraph: "现货常态化下批零倒挂持续挤压行业空间。" },
  leadItemId: "weekly-lead", overview: "本周电力市场承压。", highlights: [], sections: [], flashes: [], cover: null,
  metrics: { totalStories: 20, selectedCount: 28, reportsCovered: 3 }, readingMinutes: 4, prev: null, next: null,
};
let web: WebServer;
const api = createServer((req, res) => {
  const path = new URL(req.url!, "http://local").pathname;
  res.setHeader("Content-Type", "application/json");
  const send = (value: unknown) => res.end(JSON.stringify(value));
  if (path === "/api/site/meta") return send({ changelogVersion: "fixture" });
  if (path === "/api/site/reports/monthly/latest-page") return send({ index: [], report: null, shell: true });
  if (path === "/api/site/reports/monthly/2026-09") return send(shell);
  if (path === "/api/site/reports/monthly/navigation/2026-09") return send({ items: [] });
  if (path === "/api/site/reports/weekly/latest-page") return send({ index: [{ key: weekly.key, issueNumber: 1, title: weekly.lead!.title }], report: weekly });
  if (path === "/api/site/reports/weekly/navigation/2026-W41") return send({ items: [{ key: weekly.key, issueNumber: 1, title: weekly.lead!.title }] });
  if (path === "/api/site/reports/weekly/2026-W40") return send(weeklyShell);
  if (path === "/api/site/reports/weekly/navigation/2026-W40") return send({ items: [{ key: weekly.key, issueNumber: 1, title: weekly.lead!.title }] });
  if (path === "/api/site/reports/weekly/2026-W41") return send(weekly);
  res.statusCode = 404;
  send({ code: "not_found" });
});
before(async () => { web = await startWebServer(api); });
after(async () => { await web?.stop(); });

async function page(path: string) {
  const response = await fetch(`${web.origin}${path}`);
  assert.equal(response.status, 200, web.logs());
  return cheerio.load(await response.text());
}

test("the latest monthly page waits and does not index the placeholder", async () => {
  const copy = periodShellCopy("monthly");
  const $ = await page("/monthly");
  assert.equal($("meta[name=robots]").attr("content"), "noindex, follow");
  assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}/monthly`);
  assert.equal($("main").text().includes(copy.title), true);
  assert.equal($("main").text().includes(copy.paragraph), true);
  assert.equal($("main").text().includes("本期无可用日报数据"), false);
  assert.equal($("main").text().includes("（本期完）"), false);
  assert.equal($("script[type='application/ld+json']").text().includes("NewsArticle"), false);
});

test("the stable monthly detail URL stays up, noindex, and does not present a compiled issue", async () => {
  const copy = periodShellCopy("monthly");
  const $ = await page("/monthly/2026-09");
  assert.equal($("meta[name=robots]").attr("content"), "noindex, follow");
  assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}/monthly/2026-09`);
  assert.equal($("title").text().includes("本期无可用日报数据"), false);
  assert.equal($("main").text().includes(copy.paragraph), true);
  assert.equal($("main").text().includes("（本期完）"), false);
  assert.equal($("script[type='application/ld+json']").text().includes("NewsArticle"), false);
});

test("the empty weekly W40 detail stays up, noindex, and is not presented as an issue", async () => {
  const copy = periodShellCopy("weekly");
  const $ = await page("/weekly/2026-W40");
  assert.equal($("meta[name=robots]").attr("content"), "noindex, follow");
  assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}/weekly/2026-W40`);
  assert.equal($("title").text().includes("本期无可用日报数据"), false);
  assert.equal($("main").text().includes(copy.title), true);
  assert.equal($("main").text().includes(copy.paragraph), true);
  assert.equal($("main").text().includes("（本期完）"), false);
  assert.equal($("script[type='application/ld+json']").text().includes("NewsArticle"), false);
});

test("a real weekly issue stays indexable", async () => {
  const latest = await page("/weekly");
  assert.equal(latest("meta[name=robots]").attr("content"), undefined);
  assert.equal(latest("main").text().includes(weekly.lead!.title), true);
  const detail = await page("/weekly/2026-W41");
  assert.equal(detail("meta[name=robots]").attr("content"), undefined);
  assert.equal(detail("script[type='application/ld+json']").text().includes("NewsArticle"), true);
});
