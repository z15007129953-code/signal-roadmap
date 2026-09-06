"use client";
import { useState } from "react";
import type {
  NotificationItem,
  NotificationPage,
} from "@/features/notifications/notification-types";
export function NotificationInbox({
  workspace,
  initial,
}: {
  workspace: string;
  initial: NotificationPage;
}) {
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
          "This notification could not be marked as read. Please try again.",
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
        "Check your connection and try again. Your unread items have not changed.",
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
        setError("Older updates could not be loaded. Please try again.");
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
      setError("Check your connection and try loading updates again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid max-w-3xl gap-6">
      <p role="status" className="text-muted">
        {page.unreadCount} unread updates
      </p>
      {page.items.length ? (
        <ol className="divide-y divide-rule border-y border-rule">
          {page.items.map((item) => (
            <li
              key={item.id}
              className="grid gap-3 py-6 sm:grid-cols-[1fr_auto]"
            >
              <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
                <p className="text-sm text-muted">
                  {item.readAt ? "Read" : "Unread"} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </p>
                <h2 className="text-xl font-semibold">
                  {item.feedbackSlug ? (
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
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <section className="grid gap-3 py-8">
          <h2 className="font-serif text-2xl">Your updates will land here.</h2>
          <p className="text-muted">
            Follow a feedback item to hear when the conversation or its status
            changes.
          </p>
          <a
            href={`/${encodeURIComponent(workspace)}/feedback`}
            className="w-fit py-2 underline"
          >
            Explore feedback
          </a>
        </section>
      )}
      {page.nextCursor && (
        <button
          className="min-h-11 w-fit px-3 py-2 underline disabled:opacity-60"
          disabled={busy}
          onClick={more}
        >
          Older updates
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
