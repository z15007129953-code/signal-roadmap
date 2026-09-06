import type { FeedbackPage, FeedbackStatus } from "@/features/feedback/types";
export const roadmapLabels: Record<FeedbackStatus, string> = {
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};
export function RoadmapBoard({
  workspace,
  columns,
}: {
  workspace: string;
  columns: Record<FeedbackStatus, FeedbackPage>;
}) {
  return (
    <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-5 xl:gap-6">
      {(Object.keys(roadmapLabels) as FeedbackStatus[]).map((status) => (
        <section
          id={status}
          key={status}
          aria-labelledby={`roadmap-${status}`}
          className="min-w-0 scroll-mt-6"
        >
          <h2
            id={`roadmap-${status}`}
            className="border-t-2 border-ink pt-4 text-xl font-semibold"
          >
            {roadmapLabels[status]}
          </h2>
          {columns[status].items.length ? (
            <ol className="mt-4 divide-y divide-rule border-b border-rule">
              {columns[status].items.map((item) => (
                <li key={item.id} className="py-4">
                  <a
                    className="block min-h-11 text-base leading-snug font-medium underline decoration-rule underline-offset-4 hover:decoration-ink [overflow-wrap:anywhere]"
                    href={`/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(item.slug)}`}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-muted">No ideas here yet.</p>
          )}
          {columns[status].nextCursor && (
            <a
              className="mt-3 inline-flex min-h-11 items-center text-sm underline"
              href={`/${encodeURIComponent(workspace)}/roadmap?status=${status}&cursor=${encodeURIComponent(columns[status].nextCursor)}#${status}`}
            >
              More {roadmapLabels[status].toLowerCase()} ideas
            </a>
          )}
        </section>
      ))}
    </div>
  );
}
