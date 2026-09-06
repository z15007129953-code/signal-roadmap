"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedbackItem, FeedbackTaxonomy } from "@/features/feedback/types";
const control = "min-h-11 rounded-sm border border-control bg-panel px-3 py-2";
const button =
  "min-h-11 rounded-sm border border-control px-4 py-2 text-sm disabled:opacity-60";
const statuses = {
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};
export function ModerationPanel({
  workspace,
  item,
  taxonomy,
  tagIds,
}: {
  workspace: string;
  item: FeedbackItem;
  taxonomy: FeedbackTaxonomy;
  tagIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState(item.status);
  const [boardId, setBoardId] = useState(item.boardId);
  const [tags, setTags] = useState(tagIds);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FeedbackItem[]>([]);
  const [target, setTarget] = useState<FeedbackItem | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  async function act(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(item.id)}/moderation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.error?.code === "CONFLICT"
            ? "This idea was changed by another action. Refresh the page before trying again."
            : result.error?.code === "DEMO_EXPIRED"
              ? "This demo has expired. Start a new demo to continue."
              : "This action could not be saved. Check your permissions and try again.",
        );
        return;
      }
      setConfirmClose(false);
      setTarget(null);
      setNotice("Changes saved.");
      router.refresh();
    } catch {
      setError(
        "Check your connection and try again. No change has been confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setTarget(null);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/feedback/suggestions?title=${encodeURIComponent(query)}`,
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError("Matches could not be loaded. Please try again.");
        return;
      }
      const candidates = result.value.filter(
        (candidate: FeedbackItem) =>
          candidate.id !== item.id && candidate.visibility === "published",
      );
      setMatches(candidates);
      if (!candidates.length)
        setNotice("No published matches. Try a different phrase.");
    } catch {
      setError("Check your connection and try searching again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby={`moderation-${item.id}`}
      className="mt-10 grid max-w-3xl gap-5 border border-rule bg-panel-muted p-4 sm:p-6"
    >
      <div>
        <p className="mb-1 text-sm text-muted">Moderator tools</p>
        <h2 id={`moderation-${item.id}`} className="font-serif text-2xl">
          Make the next step clear.
        </h2>
      </div>
      {item.visibility === "pending" && (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            Publish this suggestion to open voting and discussion. Closing it
            keeps it private.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="min-h-11 rounded-sm bg-action px-4 py-2 font-semibold text-action-foreground disabled:opacity-60"
              disabled={busy}
              onClick={() => act({ action: "approve" })}
            >
              Approve and publish
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => setConfirmClose(true)}
            >
              Close without publishing
            </button>
          </div>
          {confirmClose && (
            <div
              role="group"
              aria-label="Confirm closure"
              className="grid gap-3 border border-rule p-4"
            >
              <p>Close “{item.title}” without publishing it?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => act({ action: "reject" })}
                >
                  Confirm closure
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => setConfirmClose(false)}
                >
                  Keep in review
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {item.visibility === "published" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "status", status });
          }}
          className="grid gap-2"
        >
          <label htmlFor={`status-${item.id}`} className="text-sm font-medium">
            Roadmap status
          </label>
          <div className="flex flex-wrap gap-3">
            <select
              id={`status-${item.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={control}
            >
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className={button}
              disabled={busy || status === item.status}
            >
              Save status
            </button>
          </div>
        </form>
      )}
      <details className="border-t border-rule pt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">
          Organize this idea
        </summary>
        <form
          className="mt-3 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "taxonomy", boardId, tagIds: tags });
          }}
        >
          <label className="grid gap-2 text-sm font-medium">
            Board
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className={control}
            >
              {taxonomy.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          {taxonomy.tags.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Tags · choose up to 5
              </legend>
              <div className="flex flex-wrap gap-3">
                {taxonomy.tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex min-h-11 items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={tags.includes(tag.id)}
                      disabled={!tags.includes(tag.id) && tags.length >= 5}
                      onChange={(e) =>
                        setTags((current) =>
                          e.target.checked
                            ? [...current, tag.id]
                            : current.filter((id) => id !== tag.id),
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button className={`${button} w-fit`} disabled={busy}>
            Save organization
          </button>
        </form>
      </details>
      {item.visibility === "published" ? (
        <details className="border-t border-rule pt-3">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Merge a duplicate
          </summary>
          <div className="mt-3 grid gap-4">
            <p className="text-sm text-muted">
              Keep one published idea. Votes and followers move to it,
              discussion remains attributable, and this link redirects. A merge
              cannot be undone here.
            </p>
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <label
                htmlFor={`merge-${item.id}`}
                className="text-sm font-medium"
              >
                Find the idea to keep
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  id={`merge-${item.id}`}
                  value={query}
                  minLength={3}
                  maxLength={140}
                  required
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${control} min-w-0 flex-1`}
                />
                <button className={button} disabled={busy}>
                  Find matches
                </button>
              </div>
            </form>
            <ul className="divide-y divide-rule">
              {matches.map((candidate) => (
                <li key={candidate.id} className="grid gap-2 py-3">
                  <strong>{candidate.title}</strong>
                  <p className="text-sm text-muted [overflow-wrap:anywhere]">
                    {candidate.body.slice(0, 220)}
                  </p>
                  <button
                    className={`${button} w-fit`}
                    disabled={busy}
                    onClick={() => setTarget(candidate)}
                  >
                    Keep {candidate.title}
                  </button>
                </li>
              ))}
            </ul>
            {target && (
              <div
                role="group"
                aria-label="Confirm merge"
                className="grid gap-3 border border-control p-4"
              >
                <p>
                  Merge <strong>“{item.title}”</strong> into{" "}
                  <strong>“{target.title}”</strong>?
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      act({ action: "merge", targetId: target.id })
                    }
                  >
                    Merge into {target.title}
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setTarget(null)}
                  >
                    Cancel merge
                  </button>
                </div>
              </div>
            )}
          </div>
        </details>
      ) : (
        <p className="text-sm text-muted">
          Publish this idea before merging it with another published suggestion.
        </p>
      )}
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-muted">
        {busy ? "Working…" : notice}
      </p>
    </section>
  );
}
