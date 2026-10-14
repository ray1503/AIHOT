// The home dataset description and the about-page river caption name the daily with REPORT_TITLES.
// A short industry word must not be glued on to make the product name.
import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_TITLES, RIVER_CAPTION, SITE, subjectAfter, withSubject } from "@aihot/site";
import { siteLd } from "../apps/web/app/lib/seo.ts";

const SHORT_DAILY = `另有每日精选与${withSubject("日报")}`;

test("home dataset description names the daily with REPORT_TITLES and keeps the keyword list", () => {
  const dataset = siteLd().find((node) => node["@type"] === "Dataset");
  assert.ok(dataset && "distribution" in dataset);
  const description = dataset.description;
  assert.match(description, new RegExp(`^${subjectAfter("持续更新的中文", "行业动态")}：`));
  assert.match(description, new RegExp(`另有每日精选与${REPORT_TITLES.daily}，可通过 RSS 与公开 API 获取。$`));
  assert.equal(description.includes(SHORT_DAILY), false);
  assert.equal(REPORT_TITLES.daily, "能源电力日报");
  assert.notEqual(REPORT_TITLES.daily, withSubject("日报"));
  assert.deepEqual(dataset.keywords, SITE.keywords);
  const downloads = dataset.distribution as Array<{ name: string; contentUrl: string }>;
  assert.equal(downloads.find((item) => item.contentUrl.endsWith("/feed/daily.xml"))?.name, `${REPORT_TITLES.daily} RSS`);
  assert.equal(downloads.find((item) => item.contentUrl.endsWith("/feed/weekly.xml"))?.name, `${REPORT_TITLES.weekly} RSS`);
  assert.equal(downloads.find((item) => item.contentUrl.endsWith("/feed/monthly.xml"))?.name, `${REPORT_TITLES.monthly} RSS`);
});

test("about river caption names the daily with REPORT_TITLES", () => {
  assert.match(RIVER_CAPTION, new RegExp(`汇入每天的${REPORT_TITLES.daily}。$`));
  assert.equal(RIVER_CAPTION.includes(`汇入每天的${withSubject("日报")}`), false);
});
