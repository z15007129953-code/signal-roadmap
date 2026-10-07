import Markdown from "react-markdown";
import type { ChangelogItem, Page } from "@/features/roadmap/types";
import type { Locale } from "@/lib/i18n";
export function ChangelogList({
  workspace,
  page,
  draft = false,
  locale = "en",
}: {
  workspace: string;
  page: Page<ChangelogItem>;
  draft?: boolean;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  const base = `/${encodeURIComponent(workspace)}`;
  return (
    <div className="grid max-w-4xl gap-6">
      {page.items.length ? (
        <ol className="console-panel divide-y divide-rule px-5">
          {page.items.map((item) => (
            <li key={item.id} className="grid gap-3 py-7">
              <p className="text-sm text-muted">
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString(
                      zh ? "zh-CN" : "en-US",
                      {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      },
                    )
                  : zh
                    ? "草稿 · 仅管理员可见"
                    : "Draft · visible to moderators only"}
              </p>
              <h2 className="text-2xl font-semibold [overflow-wrap:anywhere]">
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
        <section className="console-panel grid gap-3 p-8">
          <h2 className="text-2xl font-semibold">
            {draft
              ? zh
                ? "暂无草稿。"
                : "No drafts waiting."
              : zh
                ? "新的更新会从这里开始。"
                : "The next chapter starts here."}
          </h2>
          <p className="text-muted">
            {draft
              ? zh
                ? "撰写版本更新，说明发布了什么以及为什么。"
                : "Write a release to explain what shipped and why."
              : zh
                ? "已发布的产品更新会显示在这里，也可以先查看路线图。"
                : "Published product updates will appear here. In the meantime, explore what is on the roadmap."}
          </p>
          {!draft && (
            <a className="w-fit py-2 underline" href={`${base}/roadmap`}>
              {zh ? "查看路线图" : "Explore the roadmap"}
            </a>
          )}
        </section>
      )}
      {page.nextCursor && (
        <a
          href={`${base}/${draft ? "admin/changelog" : "changelog"}?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="w-fit py-2 underline"
        >
          {zh
            ? `更早的${draft ? "草稿" : "版本更新"}`
            : `Older ${draft ? "drafts" : "releases"}`}
        </a>
      )}
    </div>
  );
}
export function ChangelogDetail({
  workspace,
  item,
  locale = "en",
}: {
  workspace: string;
  item: ChangelogItem;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  return (
    <article className="console-panel grid max-w-4xl gap-6 p-6 sm:p-8">
      <p className="text-sm text-muted">
        {item.publishedAt
          ? new Date(item.publishedAt).toLocaleDateString(
              zh ? "zh-CN" : "en-US",
              {
                dateStyle: "long",
                timeZone: "UTC",
              },
            )
          : zh
            ? "私有草稿 · 仅管理员可见"
            : "Private draft · moderators only"}
      </p>
      <h1 className="text-3xl font-semibold [overflow-wrap:anywhere]">
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
          <h2 className="text-xl font-semibold">
            {zh ? "支持本次更新的反馈" : "Ideas behind this release"}
          </h2>
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
