import Markdown from "react-markdown";
import type { MergedHistoryPage } from "@/features/feedback/moderation-types";
export function MergedHistory({
  page,
  detailPath,
}: {
  page: MergedHistoryPage;
  detailPath: string;
}) {
  if (!page.items.length) return null;
  return (
    <section
      aria-labelledby="merged-history"
      className="mt-10 grid max-w-3xl gap-5 border-t border-rule pt-6"
    >
      <h2 id="merged-history" className="font-serif text-2xl">
        Earlier conversations
      </h2>
      <p className="text-muted">
        Discussion from ideas merged here. Original authors and context are
        preserved; these comments are read-only.
      </p>
      <ol className="divide-y divide-rule">
        {page.items.map(({ sourceId, sourceTitle, comment }) => (
          <li
            key={`${sourceId}-${comment.id}`}
            className="grid gap-3 py-5 [overflow-wrap:anywhere]"
          >
            <p className="text-sm text-muted">From “{sourceTitle}”</p>
            <p>
              <strong>{comment.authorName}</strong>{" "}
              <time
                dateTime={new Date(comment.createdAt).toISOString()}
                className="text-sm text-muted"
              >
                {new Date(comment.createdAt).toLocaleDateString("en", {
                  timeZone: "UTC",
                  dateStyle: "medium",
                })}
              </time>
            </p>
            {comment.parentId && (
              <p className="text-sm text-muted">
                Reply in the original discussion
              </p>
            )}
            {comment.deletedAt ? (
              <p className="text-muted">Comment removed.</p>
            ) : (
              <div className="feedback-markdown">
                <Markdown skipHtml disallowedElements={["img"]}>
                  {comment.body}
                </Markdown>
              </div>
            )}
          </li>
        ))}
      </ol>
      {page.nextCursor && (
        <a
          href={`${detailPath}?historyCursor=${encodeURIComponent(page.nextCursor)}#merged-history`}
          className="w-fit py-2 underline"
        >
          More earlier comments
        </a>
      )}
    </section>
  );
}
