"use client";

import { useState } from "react";
import { LOCALE_COOKIE, type Locale, parseLocale } from "@/lib/i18n";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageToggle({
  locale = "en",
  className = "",
}: {
  locale?: Locale;
  className?: string;
}) {
  const [selected, setSelected] = useState<Locale>(parseLocale(locale));

  function changeLocale(next: Locale) {
    if (next === selected) return;
    setSelected(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div
      aria-label="Language"
      className={`inline-flex items-center gap-0.5 rounded-sm border border-control p-0.5 text-xs font-semibold ${className}`}
      role="group"
    >
      <button
        type="button"
        aria-pressed={selected === "en"}
        onClick={() => changeLocale("en")}
        className="min-h-8 min-w-10 rounded-sm px-2 py-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={selected === "zh"}
        onClick={() => changeLocale("zh")}
        className="min-h-8 min-w-10 rounded-sm px-2 py-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
      >
        中文
      </button>
    </div>
  );
}
