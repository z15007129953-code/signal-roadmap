import type { ReactNode } from "react";
import Link from "next/link";
import type { FeedbackWorkspace } from "@/features/feedback/types";
import { feedbackPath } from "./paths";
import { DemoPersona } from "./demo-persona";

export function WorkspaceShell({
  workspace,
  children,
  moderator = false,
}: {
  workspace: FeedbackWorkspace;
  children: ReactNode;
  moderator?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:inline-block focus:py-3"
      >
        Skip to content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-rule py-5">
        <Link href="/" className="py-2 text-lg font-semibold tracking-tight">
          Signal Roadmap
          <span aria-hidden="true" className="text-action">
            {" "}
            /
          </span>
        </Link>
        <nav aria-label="Workspace" className="flex flex-wrap gap-x-6">
          <a className="py-2 underline" href={feedbackPath(workspace.slug)}>
            Feedback
          </a>
          <a
            className="py-2 underline"
            href={`/${encodeURIComponent(workspace.slug)}/notifications`}
          >
            Notifications
          </a>
          {moderator && (
            <a
              className="py-2 underline"
              href={`/${encodeURIComponent(workspace.slug)}/admin/moderation`}
            >
              Review queue
            </a>
          )}
        </nav>
      </header>
      {workspace.isDemo && (
        <aside className="flex flex-wrap gap-x-3 gap-y-1 border-b border-rule py-3 text-sm">
          <strong>Private demo</strong>
          <span className="text-muted">
            Your workspace expires 24 hours after it was created. Do not add
            sensitive information.
          </span>
          <DemoPersona role={moderator ? "moderator" : "member"} />
        </aside>
      )}
      <main id="main" className="py-8 sm:py-12">
        <p className="mb-8 text-sm font-semibold tracking-wide [overflow-wrap:anywhere]">
          {workspace.name}
        </p>
        {children}
      </main>
      <footer className="mt-8 border-t border-rule py-6 text-sm text-muted">
        A clear place for ideas and the decisions that follow.
      </footer>
    </div>
  );
}

export function FeedbackAccessNotice({ code }: { code: string }) {
  const expired = code === "DEMO_EXPIRED";
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 px-5 py-20">
      <Link href="/" className="w-fit py-2 font-semibold">
        Signal Roadmap /
      </Link>
      <h1 className="font-serif text-3xl">
        {expired
          ? "This demo has expired."
          : code === "VALIDATION_FAILED"
            ? "These filters could not be applied."
            : "This feedback is not available."}
      </h1>
      <p className="text-muted">
        {expired
          ? "Demo workspaces last 24 hours. Start a new one to keep exploring."
          : code === "VALIDATION_FAILED"
            ? "Go back to the feedback board and choose valid search filters."
            : "The link may be private, or your current session may not have access. Sign in with a workspace account, or start your own demo."}
      </p>
      <div className="flex flex-wrap gap-6">
        <Link href="/" className="py-2 underline">
          Back to home
        </Link>
        {!expired && (
          <Link
            prefetch={false}
            href="/api/auth/signin"
            className="py-2 underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
