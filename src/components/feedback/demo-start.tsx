"use client";
import { useEffect, useRef, useState } from "react";
import { feedbackPath } from "./paths";
export function DemoStart() {
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");
  const [failed, setFailed] = useState("");
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (failed) alert.current?.focus();
  }, [failed]);
  async function start() {
    if (pending) return;
    setPending(true);
    setFailed("");
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      const result = await response.json();
      if (response.status === 429) {
        const seconds = Number(response.headers.get("Retry-After"));
        setFailed(
          Number.isInteger(seconds) && seconds > 0 && seconds <= 86400
            ? `Too many demo requests. Wait ${seconds} seconds before trying again.`
            : "Too many demo requests. Wait a few minutes before trying again.",
        );
        return;
      }
      if (
        !response.ok ||
        !result.ok ||
        typeof result.value?.slug !== "string" ||
        !/^[a-z0-9-]+$/.test(result.value.slug)
      )
        throw new Error("Unavailable");
      setSlug(result.value.slug);
    } catch {
      setFailed(
        "Your demo could not be created. Check your connection and try again shortly.",
      );
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
        <p
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="max-w-prose text-critical"
        >
          {failed}
        </p>
      )}
    </div>
  );
}
