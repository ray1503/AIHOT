import { data, useLoaderData } from "react-router";
import type { Route } from "./+types/report-detail";
import type { ReportDetail, ReportNavigationResponse, ReportKind } from "@aihot/contracts/site";
import { periodShellCopy, REPORT_TITLES, SITE } from "@aihot/site";
import { apiGet, cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta, reportLd, reportTitle, titled } from "../lib/seo";
import { beijingDate } from "@aihot/contracts/time";
import { EmptyState } from "../components/ui/Page";
import { ReportLayout } from "../features/report/ReportLayout";
import { ReportPaper, reportOutline } from "../features/report/ReportPaper";
import { feedLink, kindFromPath } from "../features/report/format";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "日报" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

const PATTERN: Record<ReportKind, RegExp> = {
  daily: /^\d{4}-\d{2}-\d{2}$/,
  weekly: /^\d{4}-W\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const kind = kindFromPath(new URL(request.url).pathname);
  const key = params.key ?? "";
  if (!PATTERN[kind].test(key)) throw data({ message: "not_found" }, { status: 404 });
  const [report, { items: index }] = await Promise.all([
    loadOr404<ReportDetail>(`/api/site/reports/${kind}/${key}`, { signal: request.signal }),
    apiGet<ReportNavigationResponse>(`/api/site/reports/${kind}/navigation/${key}`, { signal: request.signal }),
  ]);
  return cachedPage(3600, { report, index, today: beijingDate(Date.now()) });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: titled("报告不存在") }, { name: "robots", content: "noindex" }];
  const r = loaderData.report;
  const path = `/${r.kind}/${r.key}`;
  if (r.shell && r.kind !== "daily") {
    const copy = periodShellCopy(r.kind);
    return [...pageMeta({
      title: `${REPORT_TITLES[r.kind]} ${r.key}`,
      description: copy.paragraph,
      path,
      image: `/og/pages/${r.kind}.png`,
      noindex: true,
    }), feedLink(r.kind)];
  }
  const description = r.lead?.leadParagraph ?? r.overview?.slice(0, 150) ?? `${SITE.name} ${r.key} 的${REPORT_TITLES[r.kind]}。`;
  return [...pageMeta({
    title: reportTitle(r),
    description,
    path,
    image: `/og/reports/${r.kind}/${r.key}.png`,
    type: "article",
    jsonLd: reportLd(r, path, description),
  }), feedLink(r.kind)];
}

export default function ReportDetailPage() {
  const { report, index, today } = useLoaderData<typeof loader>();
  if (report.shell && report.kind !== "daily") {
    const copy = periodShellCopy(report.kind);
    return (
      <ReportLayout kind={report.kind} index={index} current={null} today={today}>
        <EmptyState title={copy.title}>{copy.paragraph}</EmptyState>
      </ReportLayout>
    );
  }
  return (
    <ReportLayout kind={report.kind} index={index} current={report.key} today={today} outline={reportOutline(report)}>
      <ReportPaper report={report} index={index} />
    </ReportLayout>
  );
}
