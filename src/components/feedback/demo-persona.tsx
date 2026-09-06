"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DemoPersona({ role }: { role: "member" | "moderator" }) {
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
            ? "This demo has expired. Start a new demo from the home page."
            : "The view could not be changed. Try again shortly.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted">Viewing as {role}</span>
        <button
          type="button"
          disabled={busy}
          onClick={switchRole}
          className="min-h-11 rounded-sm border border-control px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy
            ? "Changing view…"
            : role === "member"
              ? "Try moderator view"
              : "Return to member view"}
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
