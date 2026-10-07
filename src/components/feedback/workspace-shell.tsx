import type { ReactNode } from "react";
import Link from "next/link";
import type { FeedbackWorkspace } from "@/features/feedback/types";
import { feedbackPath } from "./paths";
import { DemoPersona } from "./demo-persona";
import { SystemState } from "@/components/system/system-state";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { t, type Locale } from "@/lib/i18n";

export function WorkspaceShell({
  workspace,
  children,
  moderator = false,
  locale = "en",
}: {
  workspace: FeedbackWorkspace;
  children: ReactNode;
  moderator?: boolean;
  locale?: Locale;
}) {
  const copy = t(locale);
  const workspaceName = workspace.isDemo
    ? copy.shell.demoWorkspaceName
    : workspace.name;
  const workspaceDescription = workspace.isDemo
    ? copy.shell.demoWorkspaceDescription
    : workspace.description;
  return (
    <div className="console-frame mx-auto min-h-screen w-full max-w-7xl px-5 sm:px-8">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:inline-block focus:py-3"
      >
        {copy.shell.skipToContent}
      </a>
      <header className="console-topbar flex flex-wrap items-center justify-between gap-5 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 py-2 text-sm font-semibold tracking-[0.08em]"
          >
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <span>SIGNAL / ROADMAP</span>
          </Link>
          <span className="hidden text-xs text-muted lg:inline">
            {workspaceName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <nav
            aria-label={copy.shell.workspace}
            className="flex flex-wrap gap-1"
          >
            <a className="console-nav-link" href={feedbackPath(workspace.slug)}>
              {copy.shell.feedback}
            </a>
            <a
              className="console-nav-link"
              href={`/${encodeURIComponent(workspace.slug)}/roadmap`}
            >
              {copy.shell.roadmap}
            </a>
            <a
              className="console-nav-link"
              href={`/${encodeURIComponent(workspace.slug)}/changelog`}
            >
              {copy.shell.changelog}
            </a>
            <a
              className="console-nav-link"
              href={`/${encodeURIComponent(workspace.slug)}/notifications`}
            >
              {copy.shell.notifications}
            </a>
            {moderator && (
              <a
                className="console-nav-link"
                href={`/${encodeURIComponent(workspace.slug)}/admin/settings`}
              >
                {copy.shell.settings}
              </a>
            )}
            {moderator && (
              <a
                className="console-nav-link"
                href={`/${encodeURIComponent(workspace.slug)}/admin/changelog`}
              >
                {copy.shell.writeRelease}
              </a>
            )}
            {moderator && (
              <a
                className="console-nav-link"
                href={`/${encodeURIComponent(workspace.slug)}/admin/moderation`}
              >
                {copy.shell.reviewQueue}
              </a>
            )}
          </nav>
          <LanguageToggle locale={locale} />
        </div>
      </header>
      {workspace.isDemo && (
        <aside className="console-context flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-xs">
          <span className="status-tag status-tag--live">
            {copy.shell.privateDemo}
          </span>
          <span className="text-muted">{copy.shell.expires}</span>
          <DemoPersona
            role={moderator ? "moderator" : "member"}
            locale={locale}
          />
        </aside>
      )}
      <main id="main" className="py-8 sm:py-12">
        <div className="mb-8 grid gap-3 border-b border-rule pb-6">
          <div className="flex items-center gap-3">
            {workspace.logoKey && (
              // A scoped route serves SVG with sandbox headers, never the image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/workspaces/${encodeURIComponent(workspace.slug)}/logo?v=${encodeURIComponent(workspace.logoKey)}`}
                alt={`${workspaceName} logo`}
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            )}
            {workspace.accentColor &&
              /^#[0-9a-f]{6}$/i.test(workspace.accentColor) && (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: workspace.accentColor }}
                />
              )}
            <p className="text-sm font-semibold tracking-wide [overflow-wrap:anywhere]">
              {workspaceName}
            </p>
          </div>
          {workspaceDescription && (
            <p className="max-w-prose text-sm text-muted [overflow-wrap:anywhere]">
              {workspaceDescription}
            </p>
          )}
        </div>
        {children}
      </main>
      <footer className="mt-8 border-t border-rule py-6 text-xs text-muted">
        {copy.shell.footer}
      </footer>
    </div>
  );
}

export function FeedbackAccessNotice({ code }: { code: string }) {
  if (code === "DEMO_EXPIRED") return <SystemState kind="expired" />;
  if (code === "DEMO_QUOTA_EXCEEDED") return <SystemState kind="quota" />;
  if (code === "FORBIDDEN" || code === "UNAUTHENTICATED")
    return <SystemState kind="forbidden" />;
  const zh =
    typeof document !== "undefined" &&
    document.cookie.includes("signal-locale=zh");
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 px-5 py-20">
      <Link href="/" className="w-fit py-2 font-semibold">
        Signal Roadmap /
      </Link>
      <h1 className="font-serif text-3xl">
        {code === "VALIDATION_FAILED"
          ? zh
            ? "筛选条件无法使用。"
            : "These filters could not be applied."
          : zh
            ? "这条反馈无法查看。"
            : "This feedback is not available."}
      </h1>
      <p className="text-muted">
        {code === "VALIDATION_FAILED"
          ? zh
            ? "返回反馈列表，重新选择筛选条件。"
            : "Go back to the feedback board and choose valid search filters."
          : zh
            ? "链接可能是私有的，或当前账号没有访问权限。请登录工作区账号，或开始一个私有演示。"
            : "The link may be private, or your current session may not have access. Sign in with a workspace account, or start your own demo."}
      </p>
      <div className="flex flex-wrap gap-6">
        <Link href="/" className="py-2 underline">
          {zh ? "返回首页" : "Back to home"}
        </Link>
        <Link
          prefetch={false}
          href="/api/auth/signin"
          className="py-2 underline"
        >
          {zh ? "登录" : "Sign in"}
        </Link>
      </div>
    </main>
  );
}
