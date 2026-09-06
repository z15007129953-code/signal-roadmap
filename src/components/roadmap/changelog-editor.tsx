"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ChangelogItem,
  CompletedFeedback,
} from "@/features/roadmap/types";
const control =
  "min-h-11 w-full rounded-sm border border-control bg-panel px-3 py-2";
export function ChangelogEditor({
  workspace,
  initial,
  completed,
}: {
  workspace: string;
  initial?: ChangelogItem;
  completed: CompletedFeedback[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [feedbackIds, setFeedbackIds] = useState(
    initial?.feedback.map((item) => item.id) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState(() => [
    ...(initial?.feedback ?? []),
    ...completed.filter(
      (item) => !initial?.feedback.some((linked) => linked.id === item.id),
    ),
  ]);
  const base = `/api/workspaces/${encodeURIComponent(workspace)}/changelog`;
  function changed() {
    setDirty(true);
    setConfirm(false);
    setNotice("");
  }
  async function save(publish = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        publish
          ? `${base}/${saved!.id}/publish`
          : saved
            ? `${base}/${saved.id}`
            : base,
        {
          method: publish || !saved ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(publish
            ? {}
            : { body: JSON.stringify({ title, summary, body, feedbackIds }) }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.error?.code === "DEMO_QUOTA_EXCEEDED"
            ? "This demo has reached its release limit. Keep a copy of your draft."
            : publish && result.error?.code === "VALIDATION_FAILED"
              ? "A linked idea may no longer be published and completed. Reload this saved draft, review the remaining links, then choose Save draft to remove unavailable links before publishing again. Release notes must also contain text."
              : result.error?.code === "CONFLICT"
                ? "This release changed or is already published. Reload before making another change."
                : "The release could not be saved. Check the fields and linked completed ideas; your draft is still here.",
        );
        return;
      }
      setSaved(result.value);
      setDirty(false);
      setConfirm(false);
      setNotice(
        publish
          ? "Release published."
          : "Draft saved. Only moderators can see it.",
      );
      router.refresh();
    } catch {
      setError(
        "Check your connection and try again. Your draft has been kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${base}/completed?q=${encodeURIComponent(query)}`,
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError("Completed ideas could not be loaded. Try again.");
        return;
      }
      setChoices((current) => [
        ...current.filter((item) => feedbackIds.includes(item.id)),
        ...result.value.filter(
          (item: CompletedFeedback) => !feedbackIds.includes(item.id),
        ),
      ]);
    } catch {
      setError("Check your connection and try searching again.");
    } finally {
      setBusy(false);
    }
  }
  if (saved?.publishedAt)
    return (
      <section className="grid gap-4 py-6">
        <h2 className="font-serif text-2xl">Your release is published.</h2>
        <p className="text-muted">
          Readers can now see “{saved.title}”. Published releases are read-only
          in this version.
        </p>
        <a
          className="w-fit py-2 underline"
          href={`/${encodeURIComponent(workspace)}/changelog/${encodeURIComponent(saved.slug)}`}
        >
          Read published release
        </a>
        <a
          className="w-fit py-2 underline"
          href={`/${encodeURIComponent(workspace)}/admin/changelog`}
        >
          Back to releases
        </a>
      </section>
    );
  return (
    <div className="grid max-w-3xl gap-6">
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className="grid gap-5">
          <label className="grid gap-2 font-medium">
            Title
            <input
              className={control}
              value={title}
              minLength={5}
              maxLength={140}
              required
              onChange={(e) => {
                setTitle(e.target.value);
                changed();
              }}
            />
          </label>
          <label className="grid gap-2 font-medium">
            Summary
            <textarea
              className={control}
              value={summary}
              maxLength={300}
              rows={2}
              aria-describedby="summary-help"
              onChange={(e) => {
                setSummary(e.target.value);
                changed();
              }}
            />
          </label>
          <p id="summary-help" className="text-sm text-muted">
            Optional. A short introduction for the release list.
          </p>
          <label className="grid gap-2 font-medium">
            Release notes
            <textarea
              className={control}
              value={body}
              maxLength={10000}
              rows={10}
              onChange={(e) => {
                setBody(e.target.value);
                changed();
              }}
              aria-describedby="release-help"
            />
          </label>
          <p id="release-help" className="text-sm text-muted">
            Explain what changed and why. Markdown is supported; a release needs
            content before it can be published.
          </p>
          <button
            className="min-h-11 w-fit rounded-sm border border-control px-5 py-2 font-semibold disabled:opacity-60"
            disabled={busy}
          >
            Save draft
          </button>
        </fieldset>
      </form>
      <section
        className="grid gap-3 border-y border-rule py-5"
        aria-labelledby="linked-ideas"
      >
        <h2 id="linked-ideas" className="text-xl font-semibold">
          Completed ideas in this release
        </h2>
        <p className="text-sm text-muted">
          Link up to 20 published, completed suggestions. Save the draft after
          changing links.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
          className="grid gap-2"
        >
          <label htmlFor="completed-search" className="text-sm font-medium">
            Find completed ideas
          </label>
          <div className="flex flex-wrap gap-3">
            <input
              id="completed-search"
              className={`${control} min-w-0 flex-1`}
              maxLength={140}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="min-h-11 rounded-sm border border-control px-4 py-2"
              disabled={busy}
            >
              Search ideas
            </button>
          </div>
        </form>
        {choices.length ? (
          <div className="grid gap-1">
            {choices.map((item) => (
              <label
                key={item.id}
                className="flex min-h-11 items-start gap-3 py-2 [overflow-wrap:anywhere]"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={
                    busy ||
                    (!feedbackIds.includes(item.id) && feedbackIds.length >= 20)
                  }
                  checked={feedbackIds.includes(item.id)}
                  onChange={(e) => {
                    setFeedbackIds((current) =>
                      e.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    );
                    changed();
                  }}
                />
                {item.title}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-muted">
            No completed ideas match. You can publish a release without linking
            feedback.
          </p>
        )}
      </section>
      {saved && (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            {dirty
              ? "Save your changes before publishing."
              : "Draft saved. Publication is a separate action."}
          </p>
          <button
            className="min-h-11 w-fit rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground disabled:opacity-60"
            disabled={busy || dirty || !body.trim()}
            onClick={() => setConfirm(true)}
          >
            Publish release
          </button>
          {confirm && (
            <div
              role="group"
              aria-label="Confirm publication"
              className="grid gap-3 border border-control p-4"
            >
              <p>
                Publish “{saved.title}”? It will become visible to readers and
                notify followers of linked ideas.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className="min-h-11 rounded-sm border border-control px-4 py-2"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  Confirm publication
                </button>
                <button
                  className="min-h-11 px-4 py-2 underline"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  Keep draft
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-muted">
        {busy ? "Saving…" : notice}
      </p>
    </div>
  );
}
