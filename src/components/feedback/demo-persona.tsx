"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
export function DemoPersona({
  role,
  locale = "en",
}: {
  role: "member" | "moderator";
  locale?: Locale;
}) {
  const copy = t(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function switchRole() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: role === "member" ? "moderator" : "member",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.error?.code === "DEMO_EXPIRED"
            ? locale === "zh"
              ? "此演示已过期，请从首页重新开始。"
              : "This demo has expired. Start a new demo from the home page."
            : locale === "zh"
              ? "视图切换失败，请稍后重试。"
              : "The view could not be changed. Try again shortly.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError(
        locale === "zh"
          ? "无法连接服务，请检查网络后重试。"
          : "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted">
          {copy.shell.viewingAs}{" "}
          {role === "member" ? copy.shell.member : copy.shell.moderator}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={switchRole}
          className="min-h-11 rounded-sm border border-control px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy
            ? copy.shell.changingView
            : role === "member"
              ? copy.shell.tryModeratorView
              : copy.shell.returnToMemberView}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
