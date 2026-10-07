# Signal Roadmap console bilingual implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved dark console visual system and add persistent English/Simplified Chinese navigation copy without changing product behavior.

**Architecture:** A cookie-backed locale helper supplies server-rendered copy, while a small client toggle writes the cookie and reloads the current route. Existing domain/API code remains untouched. Global tokens and layout utilities establish the console appearance consistently across pages.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript, Vitest.

---

### Task 1: Add locale primitives

**Files:**
- Create: `src/lib/i18n.ts`
- Create: `src/components/i18n/language-toggle.tsx`
- Modify: `src/app/layout.tsx`

- [ ] Add `Locale = "en" | "zh"`, cookie name, `getLocale()` server helper, and a compact dictionary for shell labels and status labels.
- [ ] Add a client `LanguageToggle` that writes `signal-locale`, preserves the current pathname/search, and reloads.
- [ ] Keep `<html lang="en">` as the first-load default; derive the rendered language from the cookie in the root layout.
- [ ] Add unit coverage for locale parsing and fallback behavior in `src/lib/i18n.test.ts`.

### Task 2: Establish the dark console theme

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/app/globals.css`

- [ ] Replace paper canvas/surface values with graphite canvas, near-black panels, warm gray text, and restrained accent tokens using OKLCH.
- [ ] Add shared console classes for top bar, panel, metric strip, status tag, and dense list rows.
- [ ] Preserve focus rings, reduced-motion handling, responsive breakpoints, and readable contrast.

### Task 3: Rebuild the home and workspace shell

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/feedback/workspace-shell.tsx`
- Modify: `src/components/feedback/demo-persona.tsx`
- Modify: `src/components/feedback/demo-start.tsx`

- [ ] Use translated shell copy and add `LanguageToggle` to both home and workspace headers.
- [ ] Recompose the home screen into a dark console launch panel with compact operation steps.
- [ ] Convert workspace navigation into compact console links with selected-state styling while keeping all existing hrefs.
- [ ] Translate demo/member/moderator labels and retain the existing persona API calls.

### Task 4: Restyle and translate feedback surfaces

**Files:**
- Modify: `src/components/feedback/feedback-views.tsx`
- Modify: `src/components/feedback/feedback-form.tsx`
- Modify: `src/app/[workspace]/feedback/new/page.tsx`

- [ ] Translate list headings, filters, statuses, empty states, and dates while preserving user content.
- [ ] Use dense rows with metadata columns and compact status tags.
- [ ] Use a two-column detail layout on wide screens with engagement controls in a raised panel.
- [ ] Keep validation, suggestions, submission, voting, following, comments, and pending visibility behavior unchanged.

### Task 5: Restyle secondary product and moderation pages

**Files:**
- Modify: `src/components/roadmap/roadmap-board.tsx`
- Modify: `src/components/roadmap/changelog-views.tsx`
- Modify: `src/components/moderation/moderation-queue.tsx`
- Modify: `src/components/moderation/moderation-panel.tsx`
- Modify: `src/app/[workspace]/roadmap/page.tsx`
- Modify: `src/app/[workspace]/changelog/page.tsx`
- Modify: `src/app/[workspace]/notifications/page.tsx`

- [ ] Apply console panels, compact columns, and translated labels to Roadmap, Changelog, Notifications, and moderation views.
- [ ] Preserve every existing mutation endpoint and form action.

### Task 6: Verify

**Files:**
- Test: existing Vitest suites, `src/lib/i18n.test.ts`

- [ ] Run `pnpm test` and `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Open the local app, verify English default, switch to Chinese, reload, start a demo, and submit one feedback item.
- [ ] Inspect the workspace shell, feedback list, detail, moderation queue, and roadmap at desktop and narrow viewport sizes.
