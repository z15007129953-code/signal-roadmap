import Markdown from "react-markdown";
import type { ChangelogItem, Page } from "@/features/roadmap/types";
export function ChangelogList({
  workspace,
  page,
  draft = false,
}: {
  workspace: string;
  page: Page<ChangelogItem>;
  draft?: boolean;
}) {
  const base = `/${encodeURIComponent(workspace)}`;
  return (
    <div className="grid max-w-3xl gap-6">
      {page.items.length ? (
        <ol className="divide-y divide-rule border-y border-rule">
          {page.items.map((item) => (
            <li key={item.id} className="grid gap-3 py-7">
              <p className="text-sm text-muted">
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString("en", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })
                  : "Draft · visible to moderators only"}
              </p>
              <h2 className="font-serif text-2xl [overflow-wrap:anywhere]">
                <a
                  className="py-2 underline decoration-rule underline-offset-4"
                  href={
                    draft
                      ? `${base}/admin/changelog?edit=${encodeURIComponent(item.slug)}`
                      : `${base}/changelog/${encodeURIComponent(item.slug)}`
                  }
                >
                  {item.title}
                </a>
              </h2>
              <p className="text-muted [overflow-wrap:anywhere]">
                {item.summary}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <section className="grid gap-3 py-10">
          <h2 className="font-serif text-2xl">
            {draft ? "No drafts waiting." : "The next chapter starts here."}
          </h2>
          <p className="text-muted">
            {draft
              ? "Write a release to explain what shipped and why."
              : "Published product updates will appear here. In the meantime, explore what is on the roadmap."}
          </p>
          {!draft && (
            <a className="w-fit py-2 underline" href={`${base}/roadmap`}>
              Explore the roadmap
            </a>
          )}
        </section>
      )}
      {page.nextCursor && (
        <a
          href={`${base}/${draft ? "admin/changelog" : "changelog"}?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="w-fit py-2 underline"
        >
          Older {draft ? "drafts" : "releases"}
        </a>
      )}
    </div>
  );
}
export function ChangelogDetail({
  workspace,
  item,
}: {
  workspace: string;
  item: ChangelogItem;
}) {
  return (
    <article className="grid max-w-3xl gap-6">
      <p className="text-sm text-muted">
        {item.publishedAt
          ? new Date(item.publishedAt).toLocaleDateString("en", {
              dateStyle: "long",
              timeZone: "UTC",
            })
          : "Private draft · moderators only"}
      </p>
      <h1 className="font-serif text-3xl [overflow-wrap:anywhere]">
        {item.title}
      </h1>
      <p className="text-lg text-muted [overflow-wrap:anywhere]">
        {item.summary}
      </p>
      <div className="feedback-markdown border-t border-rule pt-6 [overflow-wrap:anywhere]">
        <Markdown
          skipHtml
          disallowedElements={["img"]}
          components={{
            a: ({ href, children }) => (
              <a href={href} rel="nofollow noreferrer noopener">
                {children}
              </a>
            ),
          }}
        >
          {item.body}
        </Markdown>
      </div>
      {item.feedback.length > 0 && (
        <section className="grid gap-3 border-t border-rule pt-6">
          <h2 className="text-xl font-semibold">Ideas behind this release</h2>
          <ul className="grid gap-2">
            {item.feedback.map((idea) => (
              <li key={idea.id}>
                <a
                  href={`/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(idea.slug)}`}
                  className="inline-block min-h-11 py-2 underline [overflow-wrap:anywhere]"
                >
                  {idea.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
