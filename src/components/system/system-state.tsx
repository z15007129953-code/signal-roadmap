"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { parseLocale, LOCALE_COOKIE } from "@/lib/i18n";

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
  const locale =
    typeof document === "undefined"
      ? "en"
      : parseLocale(
          document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
            ?.split("=")[1],
        );
  const translated =
    locale === "zh"
      ? {
          unexpected: [
            "页面暂时无法打开。",
            "请重新加载页面。如果问题仍然存在，请保留下面的参考编号。",
          ],
          expired: [
            "体验空间已过期。",
            "这个反馈空间有效期为 24 小时，请从首页重新开始。",
          ],
          forbidden: [
            "你无法访问此页面。",
            "请登录工作区账号，或从首页开始新的体验。",
          ],
          "not-found": [
            "找不到这个页面。",
            "链接可能不完整或页面已移动，请返回首页。",
          ],
          offline: [
            "暂时无法连接服务。",
            "请检查网络后重试。重复保存前，请先刷新确认是否已经成功。",
          ],
          quota: [
            "体验空间已达到使用上限。",
            "你仍可以浏览已有内容，需要继续体验时请从首页开始新的体验。",
          ],
        }[kind]
      : [title, message];
  const safeReference =
    reference && /^[A-Za-z0-9_-]{1,64}$/.test(reference)
      ? reference
      : undefined;
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 px-5 py-20">
      <p className="font-semibold">Signal Roadmap /</p>
      <h1 ref={heading} tabIndex={-1} className="font-serif text-3xl">
        {translated[0]}
      </h1>
      <p className="max-w-prose text-muted">{translated[1]}</p>
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
            {locale === "zh" ? "重试" : "Try again"}
          </button>
        )}
        <Link href="/" className="inline-flex min-h-11 items-center underline">
          {locale === "zh" ? "返回首页" : "Back to home"}
        </Link>
        {kind === "forbidden" && (
          <Link
            prefetch={false}
            href="/api/auth/signin"
            className="inline-flex min-h-11 items-center underline"
          >
            {locale === "zh" ? "登录" : "Sign in"}
          </Link>
        )}
      </div>
    </main>
  );
}
