"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

const states = {
  unexpected: [
    "This page is temporarily unavailable.",
    "Try loading it again. If the problem continues, keep the reference below so we can trace the failed request.",
  ],
  expired: [
    "This demo has expired.",
    "Demo workspaces last 24 hours. Start a new demo from the home page to keep exploring.",
  ],
  forbidden: [
    "You do not have access to this page.",
    "Sign in with a workspace account, or start your own private demo from the home page.",
  ],
  "not-found": [
    "That page could not be found.",
    "The link may be incomplete or the page may have moved. Return home to choose a workspace.",
  ],
  offline: [
    "We could not reach the service.",
    "Check your connection, then try again. Before repeating a save, refresh to check whether it went through.",
  ],
  quota: [
    "This demo has reached its usage limit.",
    "You can keep browsing existing content. Start a new demo from the home page when you want to make more changes.",
  ],
} as const;

export function SystemState({
  kind,
  reference,
  retry,
  reload = false,
}: {
  kind: keyof typeof states;
  reference?: string;
  retry?: () => void;
  reload?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [kind]);
  const [title, message] = states[kind];
  const safeReference =
    reference && /^[A-Za-z0-9_-]{1,64}$/.test(reference)
      ? reference
      : undefined;
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 px-5 py-20">
      <p className="font-semibold">Signal Roadmap /</p>
      <h1 ref={heading} tabIndex={-1} className="font-serif text-3xl">
        {title}
      </h1>
      <p className="max-w-prose text-muted">{message}</p>
      {safeReference && (
        <p className="break-all text-sm text-muted">
          Reference: {safeReference}
        </p>
      )}
      <div className="flex flex-wrap gap-6">
        {(retry || reload) && (
          <button
            type="button"
            onClick={retry ?? (() => window.location.reload())}
            className="min-h-11 rounded-sm border border-control px-5 py-2"
          >
            Try again
          </button>
        )}
        <Link href="/" className="inline-flex min-h-11 items-center underline">
          Back to home
        </Link>
        {kind === "forbidden" && (
          <Link
            prefetch={false}
            href="/api/auth/signin"
            className="inline-flex min-h-11 items-center underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
