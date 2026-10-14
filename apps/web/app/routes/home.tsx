import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import type { TimelineResponse } from "@aihot/contracts/site";
import { HOME_H1 } from "@aihot/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { filterLanding, filterParams, hasFeedFilters, itemListLd, listPath, pageMeta, readFilters, siteLd, titled } from "../lib/seo";
import { inNav } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";
import { Timeline } from "../features/feed/Timeline";
import { HotTopics } from "../features/feed/HotTopics";
import { ActiveFilters, CategoryTabs, FeedBar, SearchField } from "../features/feed/Filters";

export const handle: Screen = { tab: "featured", name: "精选" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  // Search lives on /all; keep the parameters so old links still land on results.
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const filters = readFilters(url.searchParams);
  const upstream = new Headers();
  const data = await loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { responseHeaders: upstream, signal: request.signal });
  return cachedPage(60, { data, filters }, upstream);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const filters = loaderData?.filters;
  const path = listPath("/", filters ? filterParams(filters) : {});
  const landing = filters?.tag ? null : filterLanding(filters);
  const titles = loaderData?.data.cards.map((c) => c.item.title) ?? [];
  if (landing) {
    return pageMeta({
      title: titled(landing.title),
      rawTitle: true,
      description: landing.description,
      path,
      noindex: true,
    });
  }
  return pageMeta({ path, noindex: hasFeedFilters(filters), jsonLd: path === "/" ? [...siteLd(), itemListLd("/", "精选", titles)] : undefined });
}

export default function Home() {
  const { data, filters } = useLoaderData<typeof loader>();
  const landing = filters.tag ? null : filterLanding(filters);
  const h1 = filters.tag ? `#${filters.tag}` : landing?.h1 ?? (filters.channel !== "all" ? "精选" : HOME_H1);
  const eyebrow = landing ? "精选 · 筛选" : h1 === HOME_H1 ? "精选" : null;
  return (
    <div className="pb-6">
      {/* Phones: the bar (精选 | 全部, filter, search), the filter in use, today's hot topics, the feed. */}
      <FeedBar base="/" category={filters.category} channel={filters.channel} />
      <ActiveFilters base="/" category={filters.category} channel={filters.channel} tag={filters.tag} />
      <div className="hidden lg:block">
        {eyebrow ? (
          <div className="flex items-center justify-between gap-6">
            <p className="min-w-0 text-[12px] font-semibold tracking-[0.08em] text-ink-4">{eyebrow}</p>
            <div className="w-60 shrink-0">
              <SearchField keep={{ category: filters.category }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6">
            <h1 className="min-w-0 flex-1 text-[24px] font-semibold leading-[1.3] text-ink [overflow-wrap:anywhere]">{h1}</h1>
            <div className="w-60 shrink-0">
              <SearchField keep={{ category: filters.category }} />
            </div>
          </div>
        )}
        {eyebrow && <h1 className="mt-1 text-[24px] font-semibold leading-[1.3] text-ink [overflow-wrap:anywhere]">{h1}</h1>}
        <CategoryTabs base="/" category={filters.category} channel={filters.channel} layoutId="home-cat-desk" className="mb-5 mt-4 min-w-0" />
      </div>

      {data.hot && inNav("/hot") && <HotTopics entries={data.hot} />}

      <Timeline initial={data} filters={data.filters} />
    </div>
  );
}
