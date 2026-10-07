# Signal Roadmap console visual and bilingual design

## Goal

Reframe Signal Roadmap as a dark, compact product operations console inspired by the supplied reference image while keeping the existing feedback, moderation, engagement, roadmap, changelog, and notification behavior intact.

## Visual direction

- Near-black graphite canvas with warm gray text and restrained panel surfaces.
- Thin borders and compact spacing create the dense control-room rhythm from the reference.
- Small semantic status tags use blue, violet, amber, green, and muted red accents; status text remains readable so color is never the only cue.
- The home page becomes a concise workspace launch screen with a primary demo action and three operational steps.
- Workspace pages use a console shell: brand and workspace navigation in the top bar, a compact context strip, and dense list/detail layouts.

## Language behavior

- English is the default on first visit, independent of browser language.
- A persistent `EN / 中文` control appears on the home page and workspace shell.
- The selected locale is stored in a first-party `signal-locale` cookie and survives navigation and reloads.
- User-authored feedback titles, descriptions, and comments remain exactly as entered.
- Core navigation, headings, controls, status labels, validation messages, and empty states are translated for English and Simplified Chinese.

## Scope

The change is limited to the existing Signal Roadmap application. No data model or API contract changes are required. The implementation adds a small locale module, a cookie-backed toggle, translated copy at the shell and primary feedback surfaces, and a global console theme.

## Acceptance criteria

1. Home and workspace surfaces render in the dark console visual system.
2. Starting a demo, submitting feedback, switching moderator view, voting, commenting, changing status, and navigating Roadmap/Changelog/Notifications still work.
3. First load is English; switching to Chinese updates the shell and primary surfaces and persists after reload.
4. User-created content is never rewritten by localization.
5. Existing unit, type, and build checks pass.
