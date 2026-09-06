"use client";
import { useState } from "react";
import { feedbackPath } from "./paths";
export function DemoStart() {
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");
  const [failed, setFailed] = useState(false);
  async function start() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      const result = await response.json();
      if (
        !response.ok ||
        !result.ok ||
        typeof result.value?.slug !== "string" ||
        !/^[a-z0-9-]+$/.test(result.value.slug)
      )
        throw new Error("Unavailable");
      setSlug(result.value.slug);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="grid justify-items-start gap-3">
      {slug ? (
        <div role="status" className="grid gap-2">
          <p>Your private demo is ready.</p>
          <a
            className="inline-flex min-h-11 items-center rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground"
            href={feedbackPath(slug)}
          >
            Open your feedback board
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="min-h-11 rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Creating your demo…" : "Start a private demo"}
        </button>
      )}
      {failed && (
        <p role="alert" className="max-w-prose text-critical">
          Your demo could not be created. Please try again shortly.
        </p>
      )}
    </div>
  );
}
