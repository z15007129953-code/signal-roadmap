"use client";
import { useState } from "react";
import Link from "next/link";
import type { EngagementState } from "@/features/feedback/engagement-types";
import type { Locale } from "@/lib/i18n";

export function EngagementControls({
  workspace,
  feedbackId,
  initial,
  canEngage,
  locale = "en",
}: {
  workspace: string;
  feedbackId: string;
  initial: EngagementState;
  canEngage: boolean;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function change(kind: "vote" | "follow") {
    if (busy) return;
    const before = state;
    const active = kind === "vote" ? !state.voted : !state.following;
    setBusy(true);
    setMessage(zh ? "正在保存…" : "Saving…");
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
            ? zh
              ? "演示已过期，请从首页重新开始。"
              : "This demo has expired. Start a new demo from the home page."
            : zh
              ? "更改未保存，请重试。"
              : "Your change could not be saved. Please try again.",
        );
        return;
      }
      setState(result.value);
      setMessage(
        kind === "vote"
          ? active
            ? zh
              ? "已投票。"
              : "Vote added."
            : zh
              ? "已取消投票。"
              : "Vote removed."
          : active
            ? zh
              ? "已关注更新。"
              : "Following updates."
            : zh
              ? "已取消关注更新。"
              : "No longer following updates.",
      );
    } catch {
      setState(before);
      setMessage(
        zh
          ? "更改未确认，请检查网络后重试。"
          : "Your change was not confirmed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={zh ? "支持这个想法" : "Support this idea"}
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
            {state.voted ? (zh ? "已投票" : "Voted") : zh ? "投票" : "Vote"} ·{" "}
            {state.voteCount}
          </button>
          <button
            type="button"
            aria-pressed={state.following}
            disabled={busy}
            onClick={() => change("follow")}
            className="min-h-11 rounded-sm border border-control px-4 py-2 disabled:opacity-60"
          >
            {state.following
              ? zh
                ? "已关注更新"
                : "Following updates"
              : zh
                ? "关注更新"
                : "Follow updates"}
          </button>
        </div>
      ) : (
        <p>
          {state.voteCount} {zh ? "票" : "votes"}.{" "}
          <Link
            prefetch={false}
            href="/api/auth/signin"
            className="inline-block py-2 underline"
          >
            {zh ? "登录后投票或关注" : "Sign in to vote or follow"}
          </Link>
        </p>
      )}
      <p role="status" className="min-h-5 text-sm text-muted">
        {message}
      </p>
    </section>
  );
}
