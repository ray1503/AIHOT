// The home share image is the site card. A deployment that never set SITE.tagline used to pass an
// undefined title, clamp threw, and GET /og/site.png answered 503 problem+json. It has to be a PNG.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.AIHOT_DATA_DIR ??= await mkdtemp(path.join(tmpdir(), "og-site-"));

const { renderOg } = await import("../packages/backend/src/media/og.ts");

test("a site share card with no title still renders a PNG", async () => {
  const { png } = await renderOg({
    kicker: "每日电力精选",
    title: undefined as unknown as string,
    subtitle: "能源电力热榜",
  });
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(png.length > 1000);
});

test("the web manifest name is only the site name", () => {
  const raw = readFileSync(new URL("../site/public/manifest.webmanifest", import.meta.url), "utf8");
  const doc = JSON.parse(raw) as { name: string; short_name: string };
  assert.equal(doc.name, "{{siteName}}");
  assert.equal(doc.short_name, "{{siteName}}");
  assert.equal(raw.includes("{{tagline}}"), false);
});

test("a topic page keeps a single h1 and leaves the monogram outside it", () => {
  const src = readFileSync(new URL("../apps/web/app/routes/topic.tsx", import.meta.url), "utf8");
  const h1s = src.match(/<h1\b[\s\S]*?<\/h1>/g) ?? [];
  assert.equal(h1s.length, 1);
  assert.equal(h1s[0]!.includes("BrandMark"), false);
  assert.match(h1s[0]!, /\{topic\.name\}/);
  assert.match(h1s[0]!, /最新动态/);
});
