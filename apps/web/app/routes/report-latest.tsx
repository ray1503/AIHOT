import { useLoaderData } from "react-router";
import type { Route } from "./+types/report-latest";
import type { ReportLatestPage } from "@aihot/contracts/site";
import { periodShellCopy, REPORT_TITLES, REPORTS } from "@aihot/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta, reportLd } from "../lib/seo";
import { beijingDate } from "@aihot/contracts/time";
import { EmptyState } from "../components/ui/Page";
import { ReportLayout } from "../features/report/ReportLayout";
import { ReportPaper, reportOutline } from "../features/report/ReportPaper";
import { feedLink, kindFromPath } from "../features/report/format";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "日报" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const kind = kindFromPath(new URL(request.url).pathname);
  const page = await loadOr404<ReportLatestPage>(`/api/site/reports/${kind}/latest-page`, { signal: request.signal });
  return cachedPage(600, { kind, report: page.report, index: page.index, shell: page.shell, today: beijingDate(Date.now()) });
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  const kind = loaderData?.kind ?? "daily";
  if (loaderData?.shell && kind !== "daily") {
    return [...pageMeta({
      title: REPORT_TITLES[kind],
      description: periodShellCopy(kind).paragraph,
      path: location.pathname,
      image: `/og/pages/${kind}.png`,
      noindex: true,
    }), feedLink(kind)];
  }
  const description = `${REPORTS.descriptions[kind]}。`;
  const report = loaderData?.report;
  return [...pageMeta({
    title: REPORT_TITLES[kind],
    description,
    path: location.pathname,
    image: `/og/pages/${kind}.png`,
    // The latest issue, described at this page's own address (its canonical).
    jsonLd: report ? reportLd(report, location.pathname, report.lead?.leadParagraph ?? description) : undefined,
  }), feedLink(kind)];
}

export default function ReportLatestPage() {
  const { kind, report, index, shell, today } = useLoaderData<typeof loader>();
  const waiting = shell && kind !== "daily" ? periodShellCopy(kind) : null;
  return (
    <ReportLayout kind={kind} index={index} current={report?.key ?? null} today={today} outline={report ? reportOutline(report) : []}>
      {report ? (
        <ReportPaper report={report} index={index} />
      ) : waiting ? (
        <EmptyState title={waiting.title}>{waiting.paragraph}</EmptyState>
      ) : (
        <EmptyState title={`还没有发布${REPORT_TITLES[kind]}`}>第一期发布后会出现在这里。</EmptyState>
      )}
    </ReportLayout>
  );
}
