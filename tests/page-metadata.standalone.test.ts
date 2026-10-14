/// <reference lib="dom" />
// Failure modes recorded before the metadata change:
// - filtered/search feeds compete with their parent or canonicalize to different content;
// - tracking and obsolete positioning parameters leak into canonical, or ordinary archives become noindex;
// - a report's title omits its visible lead, or metadata promotes a withdrawn citation;
// - an article invents a modification date from its source's publication date or omits its image;
// - a story has no machine-readable subject, or claims its first report is its own publication date.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import * as cheerio from "cheerio";
import type { FeedItemSummary, ReportCitation, ReportDetail, ReportKind, SiteItemDetail, StoryDetail } from "@aihot/contracts/site";
import { CATEGORY_KEYS, CATEGORY_LABELS, CHANNEL_LABELS } from "@aihot/contracts/taxonomy";
import { ALL_FILTER_LEAD, FILTER_LANDINGS, HOME_H1, HOT_H1, REPORT_TITLES, REPORTS, SITE, subjectAfter, withSubject } from "@aihot/site";
import { articleLd, filterLanding, readFilters, reportLd, titled } from "../apps/web/app/lib/seo.ts";
import { startWebServer, type WebServer } from "../apps/web/tests/web-server.ts";

const at = "2026-10-04T08:00:00.000Z";
const item: FeedItemSummary = { id: "metadata-fixture", title: "可核实的测试报道", summary: "报道摘要", reason: null, source: { name: "Fixture" }, publishedAt: at, timelineAt: at, category: "policy", tags: [], score: 80, selected: true, channel: "news", x: null };
const detail: SiteItemDetail = { ...item, x: null, originalTitle: null, links: { original: "https://example.org/report" }, discoveredAt: at, story: null, readingMode: "full", author: null, body: { zh: "<p>可核实的测试正文。</p>", original: null, zhKind: "original", complete: true }, outline: [], relatedStories: [], topics: [], indexable: true, markdownAvailable: true, group: null, hasTranslation: false, bodyLanguage: "zh" };
const citation = (available: boolean): ReportCitation => ({ itemId: available ? item.id : "withdrawn", title: available ? item.title : "已撤下的旧头条", summary: item.summary, sourceName: item.source.name, sourceUrl: detail.links.original, sourceIconUrl: null, firstParty: true, publishedAt: at, available });
const report = (kind: ReportKind): ReportDetail => ({ kind, key: kind === "daily" ? "2026-10-04" : kind === "weekly" ? "2026-W40" : "2026-10", issueNumber: 1, title: `${SITE.name} 测试刊物`, generatedAt: at, lead: { title: "本期已验证的重要变化", leadParagraph: "本期的导读与依据。" }, leadItemId: item.id, overview: null, highlights: [citation(true)], sections: [], flashes: [], cover: null, metrics: {}, readingMinutes: 1, prev: null, next: null });
const story: StoryDetail = { publicId: "metadata-story", title: "测试事件的最新进展", status: "settled", reportCount: 1, sourceCount: 1, firstReportAt: at, latestAt: at, digest: "当前可核实的事件综述。", digestUpdatedAt: "2026-10-04T09:00:00.000Z", summary: null, excerpt: null, latest: null, latestReport: null, whyHot: { participants48h: 0, newParticipants6h: 0, recentReports24h: 0, observationComplete: true, rank: null }, developments: [], officialReports: [], timeline: [{ id: item.id, title: item.title, summary: item.summary, source: { name: item.source.name, firstParty: true }, publishedAt: at, selected: true }], heat: [], related: [], topics: [] };
let web: WebServer;
const api = createServer((req, res) => {
  const url = new URL(req.url!, "http://local");
  const path = url.pathname;
  res.setHeader("Content-Type", "application/json");
  const send = (value: unknown) => res.end(JSON.stringify(value));
  if (path === "/api/site/meta") return send({ changelogVersion: "fixture" });
  if (path === "/api/site/timeline") return send({ filters: readFilters(url.searchParams), cards: [{ key: item.id, anchorAt: at, item, group: null }], nextCursor: null, hot: null, dayCounts: { "2026-10-04": 1 } });
  if (path === "/api/site/hot") return send({ computedAt: at, windowHours: 48, entries: [] });
  if (path === "/api/site/pool") return send({ filters: { ...readFilters(url.searchParams), q: url.searchParams.get("q"), tab: url.searchParams.get("tab") ?? "time" }, items: [item], page: Number(url.searchParams.get("page") ?? 1), pageCount: 3, total: 100, todayCount: 1, freshness: at });
  if (path === `/api/site/items/${item.id}`) return send(detail);
  if (path === `/api/site/stories/${story.publicId}`) return send(story);
  const match = /^\/api\/site\/reports\/(daily|weekly|monthly)\/(.+)$/.exec(path);
  if (match) {
    const r = report(match[1] as ReportKind);
    const index = [{ key: r.key, issueNumber: 1, title: r.title, count: 1 }];
    if (match[2] === "latest-page") return send({ report: r, index });
    if (match[2]?.startsWith("navigation/")) return send({ items: index });
    if (match[2] === r.key) return send(r);
  }
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
function structured($: cheerio.CheerioAPI): Array<Record<string, unknown>> {
  return $("script[type='application/ld+json']").toArray().flatMap((node) => JSON.parse($(node).text()));
}

test("filtered feeds keep their exact content address but leave indexing to the public landing pages", async () => {
  for (const base of ["/", "/all"]) for (const query of ["channel=news", "category=policy", "tag=Agent", "channel=x&category=market&tag=Agent"]) {
    const $ = await page(`${base}?${query}&utm_source=fixture&anchorAt=old&deep=1`);
    assert.equal($("meta[name=robots]").attr("content"), "noindex, follow", `${base}?${query}`);
    assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}${base}?${query}`);
    assert.ok($("main").text().includes(item.title));
  }
  const $ = await page("/all?q=Claude&tab=relevance&page=2&anchorAt=old");
  assert.equal($("meta[name=robots]").attr("content"), "noindex, follow");
  assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}/all?q=Claude&tab=relevance&page=2`);
});

test("home, category filters, first-party and the hot list each have one heading and their own title", async () => {
  const headings = ($: cheerio.CheerioAPI) => $("h1").toArray().map((node) => $(node).text().trim());
  const home = await page("/");
  assert.deepEqual(headings(home), [HOME_H1]);
  assert.equal(home("title").text(), SITE.homeTitle);
  assert.equal(home("meta[property='og:title']").attr("content"), SITE.homeTitle);
  assert.equal(home("meta[name=description]").attr("content"), SITE.description);
  assert.equal(home("h1").length, 1);

  for (const key of CATEGORY_KEYS) {
    const landing = filterLanding({ channel: "all", category: key });
    assert.ok(landing, key);
    assert.equal(landing.h1, CATEGORY_LABELS[key]);
    assert.equal(FILTER_LANDINGS[key].title, landing.title);
    const $ = await page(`/?category=${key}`);
    const title = titled(landing.title);
    assert.deepEqual(headings($), [landing.h1], key);
    assert.equal($("title").text(), title, key);
    assert.equal($("meta[property='og:title']").attr("content"), title, key);
    assert.equal($("meta[property='og:description']").attr("content"), landing.description, key);
    assert.equal($("meta[name=description]").attr("content"), landing.description, key);
    assert.notEqual(landing.description, SITE.description);
    assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}/?category=${key}`);
    assert.equal($("meta[name=robots]").attr("content"), "noindex, follow");
  }

  const first = filterLanding({ channel: "firstParty", category: null })!;
  assert.equal(first.h1, CHANNEL_LABELS.firstParty);
  const firstPage = await page("/?channel=firstParty");
  const firstTitle = titled(first.title);
  assert.deepEqual(headings(firstPage), [first.h1]);
  assert.equal(firstPage("title").text(), firstTitle);
  assert.equal(firstPage("meta[property='og:title']").attr("content"), firstTitle);
  assert.equal(firstPage("meta[name=description]").attr("content"), first.description);
  assert.equal(firstPage("link[rel=canonical]").attr("href"), `${web.origin}/?channel=firstParty`);

  const grid = filterLanding({ channel: "all", category: "grid" })!;
  const allGrid = await page("/all?category=grid");
  const allTitle = titled(`${grid.allName} · ${subjectAfter("全部", "动态")}`);
  assert.deepEqual(headings(allGrid), [grid.h1]);
  assert.equal(allGrid("title").text(), allTitle);
  assert.equal(allGrid("meta[property='og:title']").attr("content"), allTitle);
  assert.equal(allGrid("meta[name=description]").attr("content"), `${ALL_FILTER_LEAD}${grid.description}`);
  assert.equal(allGrid("link[rel=canonical]").attr("href"), `${web.origin}/all?category=grid`);

  const allFirst = await page("/all?channel=firstParty");
  assert.deepEqual(headings(allFirst), [CHANNEL_LABELS.firstParty]);
  assert.equal(allFirst("title").text(), titled(`${first.allName} · ${subjectAfter("全部", "动态")}`));

  const all = await page("/all");
  assert.deepEqual(headings(all), [subjectAfter("全部", "动态")]);
  assert.equal(all("title").text(), titled(subjectAfter("全部", "动态")));
  assert.equal(all("meta[name=description]").attr("content"), `${SITE.name} 收录的${subjectAfter("全部", "相关动态")}，可按频道、类别与标签筛选，支持中英文搜索。`);

  const hot = await page("/hot");
  assert.deepEqual(headings(hot), [HOT_H1]);
  assert.equal(hot("title").text(), titled(withSubject("热点榜")));
  assert.equal(hot("meta[property='og:title']").attr("content"), withSubject("热点榜"));
  assert.equal(hot("meta[name=description]").attr("content"), `${subjectAfter("过去 48 小时", "圈")}讨论最多的 10 个事件：热度指数、趋势与组成热度的公开来源。`);
  assert.ok(hot("p").toArray().some((node) => hot(node).text() === "热点"));
});

test("ordinary feed pages remain indexable and normalize ignored parameters", async () => {
  for (const [requested, canonical] of [["/?channel=invalid&category=invalid&tag=%20&utm_source=fixture", "/"], ["/all?channel=all&tab=relevance&anchorAt=old&page=2&utm_source=fixture", "/all?page=2"]]) {
    const $ = await page(requested!);
    assert.equal($("meta[name=robots]").attr("content"), undefined);
    assert.equal($("link[rel=canonical]").attr("href"), `${web.origin}${canonical}`);
    if (canonical?.includes("page=2")) assert.match($("title").text(), /第 2 页/);
  }
});

for (const [kind, label] of [["daily", "日报"], ["weekly", "周报"], ["monthly", "月报"]] as const) {
  test(`${kind} issue metadata describes its visible lead while the permanent entry keeps its title`, async () => {
    const r = report(kind);
    const $ = await page(`/${kind}/${r.key}`);
    assert.equal(REPORT_TITLES[kind], `能源电力${label}`);
    const title = `${REPORT_TITLES[kind]} ${r.key}：${r.lead!.title}`;
    assert.equal($("title").text(), `${title} · ${SITE.name}`);
    assert.equal($("meta[property='og:title']").attr("content"), title);
    assert.ok($("#report-start .sr-only").text().startsWith(REPORT_TITLES[kind]));
    assert.ok($("main").text().includes(r.lead!.title));
    const article = structured($).find((entry) => entry["@type"] === "NewsArticle")!;
    assert.equal(article.headline, title);
    assert.equal(article.image, `${web.origin}/og/reports/${kind}/${r.key}.png`);
    assert.equal("dateModified" in article, false);
    const latest = await page(`/${kind}`);
    assert.equal(latest("title").text(), `${REPORT_TITLES[kind]} · ${SITE.name}`);
    assert.equal(latest("meta[property='og:title']").attr("content"), REPORT_TITLES[kind]);
    assert.equal(latest("meta[name=description]").attr("content"), `${REPORTS.descriptions[kind]}。`);
    assert.match(REPORTS.descriptions.daily, /发布的能源电力行业精编日报/);
    assert.doesNotMatch(REPORTS.descriptions.daily, /发布的电力行业精编日报/);
    assert.ok(latest("#report-start .sr-only").text().includes(REPORT_TITLES[kind]));
  });
}

test("a report without an edited lead uses only a still-public visible highlight", () => {
  const r = { ...report("weekly"), lead: null, highlights: [citation(false), citation(true)] };
  assert.match(reportLd(r, "/weekly/2026-W40", "导读").headline, new RegExp(item.title));
  assert.doesNotMatch(reportLd(r, "/weekly/2026-W40", "导读").headline, /已撤下/);
});

test("article metadata has a representative image and does not invent an update timestamp", async () => {
  const $ = await page(`/items/${item.id}`);
  const article = structured($).find((entry) => entry["@type"] === "NewsArticle")!;
  assert.equal(article.image, `${web.origin}/og/items/${item.id}.png`);
  assert.equal(article.datePublished, at);
  assert.equal("dateModified" in article, false);
  assert.equal(article.isBasedOn, detail.links.original);
  assert.deepEqual(article.author, { "@id": `${web.origin}/#organization` });
  const modified = "2026-10-04T10:00:00.000Z";
  assert.equal(articleLd({ path: "/items/test", headline: "更正", modifiedAt: modified }).dateModified, modified);
});

test("story metadata describes the visible collection, current summary and report list", async () => {
  const $ = await page(`/story/${story.publicId}`);
  const collection = structured($).find((entry) => entry["@type"] === "CollectionPage")!;
  assert.ok(collection);
  assert.equal(collection.name, story.title);
  assert.equal(collection.description, story.digest);
  assert.equal(collection.dateModified, story.digestUpdatedAt);
  assert.equal("datePublished" in collection, false);
  const list = collection.mainEntity as { itemListElement: Array<{ name: string }> };
  assert.deepEqual(list.itemListElement.map((entry) => entry.name), [item.title]);
  assert.ok($("main").text().includes(story.digest!));
});
