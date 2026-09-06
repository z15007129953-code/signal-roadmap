"use client";
import { useState } from "react";
import Link from "next/link";
import type { EngagementState } from "@/features/feedback/engagement-types";

export function EngagementControls({
  workspace,
  feedbackId,
  initial,
  canEngage,
}: {
  workspace: string;
  feedbackId: string;
  initial: EngagementState;
  canEngage: boolean;
}) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function change(kind: "vote" | "follow") {
    if (busy) return;
    const before = state;
    const active = kind === "vote" ? !state.voted : !state.following;
    setBusy(true);
    setMessage("Saving…");
    setState(
      kind === "vote"
        ? {
            ...state,
            voted: active,
            voteCount: state.voteCount + (active ? 1 : -1),
          }
        : { ...state, following: active },
    );
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(feedbackId)}/${kind}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setState(before);
        setMessage(
          result.error?.code === "DEMO_EXPIRED"
            ? "This demo has expired. Start a new demo from the home page."
            : "Your change could not be saved. Please try again.",
        );
        return;
      }
      setState(result.value);
      setMessage(
        kind === "vote"
          ? active
            ? "Vote added."
            : "Vote removed."
          : active
            ? "Following updates."
            : "No longer following updates.",
      );
    } catch {
      setState(before);
      setMessage(
        "Your change was not confirmed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Support this idea"
      className="my-8 grid gap-3 border-y border-rule py-5"
    >
      {canEngage ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-pressed={state.voted}
            disabled={busy}
            onClick={() => change("vote")}
            className="min-h-11 rounded-sm border border-control px-4 py-2 font-semibold disabled:opacity-60"
          >
            {state.voted ? "Voted" : "Vote"} · {state.voteCount}
          </button>
          <button
            type="button"
            aria-pressed={state.following}
            disabled={busy}
            onClick={() => change("follow")}
            className="min-h-11 rounded-sm border border-control px-4 py-2 disabled:opacity-60"
          >
            {state.following ? "Following updates" : "Follow updates"}
          </button>
        </div>
      ) : (
        <p>
          {state.voteCount} votes.{" "}
          <Link
            prefetch={false}
            href="/api/auth/signin"
            className="inline-block py-2 underline"
          >
            Sign in to vote or follow
          </Link>
        </p>
      )}
      <p role="status" className="min-h-5 text-sm text-muted">
        {message}
      </p>
    </section>
  );
}
