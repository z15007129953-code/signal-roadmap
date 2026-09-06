"use client";
import Link from "next/link";
export default function FeedbackError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid max-w-2xl gap-5 px-5 py-20">
      <h1 className="font-serif text-3xl">
        Feedback is temporarily unavailable.
      </h1>
      <p className="text-muted">
        We could not load this workspace. Try again in a moment.
      </p>
      <button
        onClick={reset}
        className="min-h-11 w-fit rounded-sm border border-control px-5 py-2"
      >
        Try again
      </button>
      <Link href="/" className="w-fit py-2 underline">
        Back to home
      </Link>
    </main>
  );
}
