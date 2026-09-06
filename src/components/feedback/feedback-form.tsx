"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FeedbackItem, FeedbackTaxonomy } from "@/features/feedback/types";
import { feedbackPath } from "./paths";

const control =
  "min-h-11 w-full rounded-sm border border-control bg-panel px-3 py-2";
type Field = "title" | "description" | "boardId" | "tagIds";
const failureMessages: Record<string, string> = {
  DEMO_QUOTA_EXCEEDED:
    "This demo has reached its usage limit. Keep a copy of your draft, then start a new demo from the home page.",
  DEMO_EXPIRED:
    "This demo has expired. Keep a copy of your draft, then start a new demo from the home page.",
  UNAUTHENTICATED:
    "Your session is no longer available. Keep a copy of your draft and sign in again.",
  FORBIDDEN:
    "You cannot send feedback to this workspace with your current session.",
  RATE_LIMITED: "Too many requests. Wait a moment before sending again.",
  VALIDATION_FAILED:
    "Check your title, description, board and tags, then try again.",
};

export function FeedbackForm({
  workspace,
  taxonomy,
}: {
  workspace: string;
  taxonomy: FeedbackTaxonomy;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [boardId, setBoardId] = useState(taxonomy.boards[0]?.id ?? "");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<FeedbackItem | null>(null);
  const [suggestions, setSuggestions] = useState<FeedbackItem[]>([]);
  const [suggestionState, setSuggestionState] = useState("");
  const [finding, setFinding] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const latestTitle = useRef(title);
  useEffect(() => {
    latestTitle.current = title;
  }, [title]);
  useEffect(() => {
    if (failure || Object.keys(errors).length) summary.current?.focus();
  }, [failure, errors]);
  useEffect(() => {
    if (saved) success.current?.focus();
  }, [saved]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const next: Partial<Record<Field, string>> = {};
    if (title.trim().length < 5 || title.trim().length > 140)
      next.title = "Title needs 5–140 characters.";
    if (description.trim().length < 10 || description.trim().length > 10000)
      next.description = "Description needs 10–10,000 characters.";
    if (!taxonomy.boards.some((board) => board.id === boardId))
      next.boardId = "Choose an available board.";
    if (tagIds.length > 5) next.tagIds = "Choose no more than 5 tags.";
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            boardId,
            tagIds,
          }),
        },
      );
      const result = await response.json();
      if (response.ok && result.ok && typeof result.value?.slug === "string")
        setSaved(result.value);
      else
        setFailure(
          failureMessages[result.error?.code] ??
            "Your feedback could not be saved. Your draft is still here; try again shortly.",
        );
    } catch {
      setFailure(
        "We could not reach the server. Your draft is still here; check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function findSimilar() {
    const searchedTitle = title;
    setFinding(true);
    setSuggestions([]);
    setSuggestionState("Looking for similar feedback…");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/feedback/suggestions?title=${encodeURIComponent(title)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok || !result.ok || !Array.isArray(result.value))
        throw new Error("Unavailable");
      if (latestTitle.current !== searchedTitle) return;
      setSuggestions(result.value.slice(0, 3));
      setSuggestionState(
        result.value.length
          ? "Related feedback — take a look before adding yours."
          : "No similar titles found. Your perspective is welcome.",
      );
    } catch {
      if (latestTitle.current === searchedTitle)
        setSuggestionState(
          "Similar feedback is unavailable. You can still send your idea.",
        );
    } finally {
      setFinding(false);
    }
  }

  if (saved)
    return (
      <div
        ref={success}
        tabIndex={-1}
        role="status"
        className="grid gap-4 border-y border-rule py-8"
      >
        <h2 className="font-serif text-2xl">
          {saved.visibility === "pending"
            ? "Your feedback is awaiting review."
            : "Your feedback is published."}
        </h2>
        <p className="max-w-prose text-muted">
          {saved.visibility === "pending"
            ? "Only you and this workspace’s moderators can see it until it is published."
            : "It is now available on this workspace’s feedback board."}
        </p>
        <a
          className="w-fit py-2 font-medium underline"
          href={`${feedbackPath(workspace)}/${encodeURIComponent(saved.slug)}`}
        >
          View your feedback
        </a>
      </div>
    );

  return (
    <form noValidate onSubmit={submit} className="grid max-w-2xl gap-6">
      {(failure || Object.keys(errors).length > 0) && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="grid gap-2 rounded-sm border border-critical p-4"
        >
          <h2 className="font-semibold">
            {failure ? "Feedback was not sent" : "Check these fields"}
          </h2>
          {failure && <p>{failure}</p>}
          {Object.entries(errors).map(([field, message]) => (
            <a className="underline" href={`#${field}`} key={field}>
              {message}
            </a>
          ))}
        </div>
      )}
      <fieldset disabled={sending} className="grid min-w-0 gap-6">
        <div className="grid gap-2">
          <label htmlFor="title" className="font-semibold">
            Title
          </label>
          <p id="title-hint" className="text-sm text-muted">
            One clear idea in 5–140 characters.
          </p>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSuggestions([]);
              setSuggestionState("");
            }}
            maxLength={140}
            required
            aria-invalid={!!errors.title}
            aria-describedby={`title-hint${errors.title ? " title-error" : ""}`}
            className={control}
          />
          {errors.title && (
            <p id="title-error" className="text-critical">
              {errors.title}
            </p>
          )}
          <button
            type="button"
            onClick={findSimilar}
            disabled={finding || title.trim().length < 3}
            className="min-h-11 w-fit text-sm underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {finding ? "Finding similar feedback…" : "Find similar feedback"}
          </button>
          {suggestionState && (
            <p role="status" className="text-sm text-muted">
              {suggestionState}
            </p>
          )}
          {suggestions.length > 0 && (
            <ul className="grid gap-2">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <a
                    href={`${feedbackPath(workspace)}/${encodeURIComponent(item.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-2 underline [overflow-wrap:anywhere]"
                  >
                    {item.title}{" "}
                    <span className="text-sm text-muted">
                      (opens a new tab)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-2">
          <label htmlFor="description" className="font-semibold">
            Description
          </label>
          <p id="description-hint" className="text-sm text-muted">
            What are you trying to do, and what would help? 10–10,000
            characters. Markdown is supported; HTML and embedded images are not.
          </p>
          <textarea
            id="description"
            name="description"
            rows={8}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={10000}
            required
            aria-invalid={!!errors.description}
            aria-describedby={`description-hint${errors.description ? " description-error" : ""}`}
            className={`${control} resize-y`}
          />
          {errors.description && (
            <p id="description-error" className="text-critical">
              {errors.description}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <label htmlFor="boardId" className="font-semibold">
            Board
          </label>
          <select
            id="boardId"
            name="boardId"
            value={boardId}
            onChange={(event) => setBoardId(event.target.value)}
            required
            aria-invalid={!!errors.boardId}
            aria-describedby={errors.boardId ? "boardId-error" : undefined}
            className={control}
          >
            {!taxonomy.boards.length && (
              <option value="">No boards available</option>
            )}
            {taxonomy.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          {errors.boardId && (
            <p id="boardId-error" className="text-critical">
              {errors.boardId}
            </p>
          )}
        </div>
        {taxonomy.tags.length > 0 && (
          <fieldset
            id="tagIds"
            tabIndex={-1}
            aria-describedby={errors.tagIds ? "tagIds-error" : "tags-hint"}
          >
            <legend className="font-semibold">
              Tags <span className="font-normal text-muted">(optional)</span>
            </legend>
            <p id="tags-hint" className="text-sm text-muted">
              Choose up to 5.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6">
              {taxonomy.tags.map((tag) => (
                <label
                  className="flex min-h-11 items-center gap-2"
                  key={tag.id}
                >
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    checked={tagIds.includes(tag.id)}
                    onChange={(event) =>
                      setTagIds(
                        event.target.checked
                          ? [...tagIds, tag.id]
                          : tagIds.filter((id) => id !== tag.id),
                      )
                    }
                    className="size-5 accent-action"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
            {errors.tagIds && (
              <p id="tagIds-error" className="text-critical">
                {errors.tagIds}
              </p>
            )}
          </fieldset>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <button
            type="submit"
            className="min-h-11 rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {sending ? "Sending feedback…" : "Send feedback"}
          </button>
          <a
            className="py-2 text-muted underline"
            href={feedbackPath(workspace)}
          >
            Back to feedback
          </a>
        </div>
      </fieldset>
    </form>
  );
}
