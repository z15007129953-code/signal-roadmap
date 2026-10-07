"use client";
import { useState } from "react";
import type {
  NotificationItem,
  NotificationPage,
} from "@/features/notifications/notification-types";
import type { Locale } from "@/lib/i18n";
export function NotificationInbox({
  workspace,
  initial,
  locale = "en",
}: {
  workspace: string;
  initial: NotificationPage;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/api/workspaces/${encodeURIComponent(workspace)}/notifications`;
  async function read(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PATCH",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          zh
            ? "这条通知无法标记为已读，请重试。"
            : "This notification could not be marked as read. Please try again.",
        );
        return;
      }
      setPage((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        items: current.items.map((item) =>
          item.id === id ? { ...item, readAt: result.value.readAt } : item,
        ),
      }));
    } catch {
      setError(
        zh
          ? "请检查网络后重试，未读状态没有改变。"
          : "Check your connection and try again. Your unread items have not changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (busy || !page.nextCursor) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${base}?cursor=${encodeURIComponent(page.nextCursor)}`,
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          zh
            ? "更早的通知无法加载，请重试。"
            : "Older updates could not be loaded. Please try again.",
        );
        return;
      }
      setPage((current) => ({
        ...result.value,
        items: [
          ...current.items,
          ...result.value.items.filter(
            (item: NotificationItem) =>
              !current.items.some((existing) => existing.id === item.id),
          ),
        ],
      }));
    } catch {
      setError(
        zh
          ? "请检查网络后重新加载通知。"
          : "Check your connection and try loading updates again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid max-w-4xl gap-6">
      <p role="status" className="text-muted">
        {zh
          ? `${page.unreadCount} 条未读通知`
          : `${page.unreadCount} unread updates`}
      </p>
      {page.items.length ? (
        <ol className="console-panel divide-y divide-rule px-5">
          {page.items.map((item) => (
            <li
              key={item.id}
              className="dense-row grid gap-3 py-6 sm:grid-cols-[1fr_auto]"
            >
              <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
                <p className="text-sm text-muted">
                  {item.readAt
                    ? zh
                      ? "已读"
                      : "Read"
                    : zh
                      ? "未读"
                      : "Unread"}{" "}
                  ·{" "}
                  {new Date(item.createdAt).toLocaleDateString(
                    zh ? "zh-CN" : "en-US",
                    { dateStyle: "medium", timeZone: "UTC" },
                  )}
                </p>
                <h2 className="text-xl font-semibold">
                  {item.changelogSlug ? (
                    <a
                      href={`/${encodeURIComponent(workspace)}/changelog/${encodeURIComponent(item.changelogSlug)}`}
                      className="py-2 underline"
                    >
                      {item.title}
                    </a>
                  ) : item.feedbackSlug ? (
                    <a
                      href={`/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(item.feedbackSlug)}`}
                      className="py-2 underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.body && <p className="text-muted">{item.body}</p>}
              </div>
              {!item.readAt && (
                <button
                  className="min-h-11 w-fit self-start rounded-sm border border-control px-3 py-2 text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => read(item.id)}
                >
                  {zh ? "标记为已读" : "Mark as read"}
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <section className="console-panel grid gap-3 p-8">
          <h2 className="text-2xl font-semibold">
            {zh ? "你的通知会显示在这里。" : "Your updates will land here."}
          </h2>
          <p className="text-muted">
            {zh
              ? "关注一条反馈后，你会在讨论或状态变化时收到通知。"
              : "Follow a feedback item to hear when the conversation or its status changes."}
          </p>
          <a
            href={`/${encodeURIComponent(workspace)}/feedback`}
            className="w-fit py-2 underline"
          >
            {zh ? "浏览反馈" : "Explore feedback"}
          </a>
        </section>
      )}
      {page.nextCursor && (
        <button
          className="min-h-11 w-fit px-3 py-2 underline disabled:opacity-60"
          disabled={busy}
          onClick={more}
        >
          {zh ? "更早的通知" : "Older updates"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
