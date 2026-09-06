import type { FeedbackPage } from "@/features/feedback/types";
import { feedbackPath } from "@/components/feedback/paths";
export function ModerationQueue({
  workspace,
  page,
}: {
  workspace: string;
  page: FeedbackPage;
}) {
  const base = feedbackPath(workspace);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="text-sm text-muted">Community stewardship</p>
        <h1 className="font-serif text-3xl">Review queue</h1>
        <p className="max-w-prose text-muted">
          Read the context, publish useful suggestions, and bring duplicates
          into one conversation.
        </p>
      </div>
      {page.items.length ? (
        <>
          <div
            className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem] gap-6 border-b border-rule pb-3 text-sm font-semibold sm:grid"
            aria-hidden="true"
          >
            <span>Suggestion</span>
            <span>Submitted</span>
            <span>Action</span>
          </div>
          <ol className="divide-y divide-rule border-b border-rule">
            {page.items.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:gap-6"
              >
                <div className="grid min-w-0 gap-2">
                  <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">
                    {item.title}
                  </h2>
                  <p className="text-sm text-muted">
                    {item.status === "closed"
                      ? "Closed · not public"
                      : "Awaiting review · not public"}
                  </p>
                </div>
                <time
                  className="text-sm text-muted"
                  dateTime={item.createdAt.toISOString()}
                >
                  {item.createdAt.toLocaleDateString("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </time>
                <a
                  className="inline-flex min-h-11 items-center self-start underline"
                  href={`${base}/${encodeURIComponent(item.slug)}`}
                >
                  Review idea<span className="sr-only">: {item.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <section className="grid gap-3 py-10">
          <h2 className="font-serif text-2xl">Nothing waiting for review.</h2>
          <p className="text-muted">
            New member submissions will appear here. You can also change status
            or merge duplicates from any published idea.
          </p>
          <a href={base} className="w-fit py-2 underline">
            Browse published feedback
          </a>
        </section>
      )}
      {page.nextCursor && (
        <a
          href={`/${encodeURIComponent(workspace)}/admin/moderation?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="w-fit py-2 underline"
        >
          More submissions
        </a>
      )}
    </div>
  );
}
