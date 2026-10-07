"use client";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import Link from "next/link";
import type {
  CommentItem,
  CommentPage,
} from "@/features/feedback/engagement-types";
import type { Locale } from "@/lib/i18n";
const button =
  "min-h-11 rounded-sm border border-control px-3 py-2 text-sm disabled:opacity-60";
export function CommentThread({
  workspace,
  feedbackId,
  initial,
  canComment,
  locale = "en",
}: {
  workspace: string;
  feedbackId: string;
  initial: CommentPage;
  canComment: boolean;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  const [notice, setNotice] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  // Keep locally appended comments after all cursor-loaded older comments.
  // Preserve database order rather than re-sorting millisecond JS timestamps.
  const locallyPosted = useRef(new Set<string>());
  const base = `/api/workspaces/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(feedbackId)}/comments`;
  async function save(method: "POST" | "PATCH" | "DELETE", id?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        id ? `${base}/${encodeURIComponent(id)}` : base,
        {
          method,
          headers: { "Content-Type": "application/json" },
          ...(method === "DELETE"
            ? {}
            : {
                body: JSON.stringify(
                  method === "POST"
                    ? { body, parentId: replyTo?.id ?? null }
                    : { body: editBody },
                ),
              }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.error?.code === "DEMO_QUOTA_EXCEEDED"
            ? zh
              ? "演示已达到评论上限，草稿仍保留。"
              : "This demo has reached its comment limit. Your draft is still here."
            : result.error?.code === "DEMO_EXPIRED"
              ? zh
                ? "演示已过期，请复制草稿后重新开始。"
                : "This demo has expired. Copy your draft before starting a new demo."
              : zh
                ? "评论未保存，草稿仍保留，请重试。"
                : "The comment could not be saved. Your draft is still here; please try again.",
        );
        return;
      }
      if (method === "POST") locallyPosted.current.add(result.value.id);
      setItems((current) =>
        method === "POST"
          ? [...current, result.value]
          : current.map((item) => (item.id === id ? result.value : item)),
      );
      if (method === "POST") {
        setBody("");
        setReplyTo(null);
      }
      setEditing(null);
      setDeleting(null);
      setNotice(
        method === "POST"
          ? zh
            ? "评论已发布。"
            : "Comment posted."
          : method === "PATCH"
            ? zh
              ? "评论已更新。"
              : "Comment updated."
            : zh
              ? "评论已删除。"
              : "Comment deleted.",
      );
    } catch {
      setError(
        zh
          ? "请检查网络后重试，草稿已保留。"
          : "Check your connection and try again. Your draft has been kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadMore() {
    if (busy || !cursor) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${base}?cursor=${encodeURIComponent(cursor)}`,
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          zh
            ? "更多评论无法加载，请重试。"
            : "More comments could not be loaded. Please try again.",
        );
        return;
      }
      const pendingIds = new Set(locallyPosted.current);
      const incoming: CommentItem[] = result.value.items;
      for (const item of incoming) locallyPosted.current.delete(item.id);
      setItems((current) => {
        const stored = current.filter((item) => !pendingIds.has(item.id));
        return [
          ...stored,
          ...incoming.filter(
            (item) => !stored.some((existing) => existing.id === item.id),
          ),
          ...current.filter(
            (item) =>
              pendingIds.has(item.id) &&
              !incoming.some((next) => next.id === item.id),
          ),
        ];
      });
      setCursor(result.value.nextCursor);
    } catch {
      setError(
        zh
          ? "请检查网络后重新加载评论。"
          : "Check your connection and try loading comments again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="discussion-title"
      className="mt-10 grid max-w-3xl gap-6"
    >
      <h2 id="discussion-title" className="font-serif text-2xl">
        {zh ? "讨论" : "Discussion"}
      </h2>
      {items.length === 0 && (
        <p className="text-muted">
          {zh
            ? "还没有评论。补充背景、提出问题，或说明这个想法如何帮助你。"
            : "No comments yet. Add context, ask a question, or explain how this would help."}
        </p>
      )}
      <ol className="divide-y divide-rule">
        {items.map((item) => (
          <li
            key={item.id}
            id={`comment-${item.id}`}
            className="grid gap-3 py-5 [overflow-wrap:anywhere]"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong>{item.authorName}</strong>
              <time
                className="text-sm text-muted"
                dateTime={new Date(item.createdAt).toISOString()}
              >
                {new Date(item.createdAt).toLocaleDateString("en", {
                  timeZone: "UTC",
                  dateStyle: "medium",
                })}
              </time>
              {new Date(item.updatedAt).getTime() >
                new Date(item.createdAt).getTime() && (
                <span className="text-sm text-muted">
                  {zh ? "已编辑" : "Edited"}
                </span>
              )}
            </div>
            {item.parentId && (
              <a
                href={`#comment-${item.parentId}`}
                className="w-fit py-2 text-sm underline"
              >
                {zh ? "回复" : "Reply to"}{" "}
                {items.find((parent) => parent.id === item.parentId)
                  ?.authorName ?? (zh ? "之前的评论" : "an earlier comment")}
              </a>
            )}
            {item.deletedAt ? (
              <p className="text-muted">
                {zh ? "评论已删除。" : "Comment removed."}
              </p>
            ) : editing === item.id ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save("PATCH", item.id);
                }}
              >
                <label
                  htmlFor={`edit-${item.id}`}
                  className="text-sm font-medium"
                >
                  {zh ? "编辑评论" : "Edit comment"}
                </label>
                <textarea
                  id={`edit-${item.id}`}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  required
                  maxLength={10000}
                  rows={4}
                  className="w-full rounded-sm border border-control bg-panel p-3"
                />
                <div className="flex flex-wrap gap-3">
                  <button className={button} disabled={busy}>
                    {zh ? "保存更改" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    {zh ? "取消编辑" : "Cancel editing"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="feedback-markdown">
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
            )}
            {deleting === item.id ? (
              <div className="grid gap-2 border border-rule p-4">
                <p>
                  {zh
                    ? "删除这条评论？评论内容会被移除，但回复会保留。"
                    : "Delete this comment? Its text will be removed, but replies will stay."}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => save("DELETE", item.id)}
                  >
                    {zh ? "确认删除" : "Confirm deletion"}
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setDeleting(null)}
                  >
                    {zh ? "保留评论" : "Keep comment"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canComment && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setReplyTo(item);
                      field.current?.focus();
                    }}
                  >
                    {zh ? "回复" : "Reply"}
                  </button>
                )}
                {item.canEdit && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setEditing(item.id);
                      setEditBody(item.body);
                    }}
                  >
                    {zh ? "编辑" : "Edit"}
                  </button>
                )}
                {item.canDelete && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setDeleting(item.id)}
                  >
                    {zh ? "删除" : "Delete"}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {cursor && (
        <button
          type="button"
          className={`${button} w-fit`}
          disabled={busy}
          onClick={loadMore}
        >
          {zh ? "加载更多评论" : "Load more comments"}
        </button>
      )}
      {canComment ? (
        <form
          className="grid gap-3 border-t border-rule pt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save("POST");
          }}
        >
          {replyTo && (
            <div className="flex flex-wrap items-center gap-3">
              <p>
                {zh ? "正在回复" : "Replying to"} {replyTo.authorName}
              </p>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => setReplyTo(null)}
              >
                {zh ? "取消回复" : "Cancel reply"}
              </button>
            </div>
          )}
          <label htmlFor="new-comment" className="font-medium">
            {zh ? "你的评论" : "Your comment"}
          </label>
          <textarea
            ref={field}
            id="new-comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={10000}
            rows={4}
            className="w-full rounded-sm border border-control bg-panel p-3"
            aria-describedby="comment-help"
          />
          <p id="comment-help" className="text-sm text-muted">
            {zh
              ? "请保持建设性，支持 Markdown，请勿包含私人信息。"
              : "Keep it constructive. Markdown is supported. Do not include private information."}
          </p>
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="min-h-11 w-fit rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground disabled:opacity-60"
          >
            {busy
              ? zh
                ? "正在保存…"
                : "Saving…"
              : replyTo
                ? zh
                  ? "发布回复"
                  : "Post reply"
                : zh
                  ? "发布评论"
                  : "Post comment"}
          </button>
        </form>
      ) : (
        <Link
          prefetch={false}
          href="/api/auth/signin"
          className="w-fit py-2 underline"
        >
          {zh ? "登录后参与讨论" : "Sign in to join the discussion"}
        </Link>
      )}
      {error && (
        <p
          ref={errorSummary}
          tabIndex={-1}
          role="alert"
          className="text-critical"
        >
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-muted">
        {notice}
      </p>
    </section>
  );
}
