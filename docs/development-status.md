# Development status — 6 September 2026

Signal Roadmap is under active implementation. Feedback, voting, following,
comments and notifications now work with project-local PostgreSQL 17.11 and
have a persisted Chrome acceptance journey. No GitHub repository or deployment
has been published. Release each completed product publicly; use Chrome for login.

## Implemented foundations

- Independent Next.js application and semantic light/dark design tokens.
- Contrast-tested colors and utility-compatible base styles, following the
  approved Impeccable design context. Temporary local font fallbacks let builds
  run without contacting Google Fonts.
- PostgreSQL/Drizzle schema, initial SQL migration, isolated Compose services,
  environment validation, guarded migration/reset commands, and integration tests.
- Typed results and safe public error responses; member, moderator and owner
  authorization with explicit workspace checks.
- Lazy Auth.js email configuration and Drizzle adapter. Production requires SMTP;
  only development may print sign-in links. Canonical APP_URL controls auth URLs.
- Signed demo credential primitives, immutable identity resolution, and scoped
  membership queries. An invalid demo cookie never falls through to an account
  with greater privileges.
- Demo creation, signed HTTP-only cookies, persisted member/moderator switching,
  and cleanup interfaces. Creation atomically adds a workspace, both personas,
  and one starter board. Cleanup processes at most 100 expired demos and excludes
  showcase workspaces and workspaces with any active session.

## Feedback submission and discovery

- Workspace-scoped list, detail and submission pages, plus a product homepage
  with an isolated-demo entry point. The interface follows the approved editorial
  noticeboard direction: titles and readable status labels lead, with visible
  search/filter/submit controls and no fabricated engagement.
- Strict title/body/taxonomy input validation, readable UUID-suffixed slugs,
  persisted membership and role checks, and an atomic 30-feedback demo quota.
- Published lists, author/moderator-only pending details, a read-only moderator
  queue, and private demo reads. Moderators can approve, close and merge items.
- Board/tag/status/literal-title filters and descending timestamp/ID pagination.
  Cursor validation preserves PostgreSQL microseconds and rejects impossible dates.
- Up to three optional similar-title suggestions. A failed or stale suggestion
  request does not block submission.
- Labelled controls, keyboard submission, focused field-linked validation,
  retained drafts after network/quota errors, pending-review confirmation,
  loading, empty and unavailable states. Markdown disables raw HTML and embedded
  images; unsafe link protocols are rejected by the Markdown renderer.
- POST `/api/workspaces/[workspace]/feedback` requires exact Origin and bounded
  JSON input. Suggestions use a scoped GET endpoint. Both return no-store
  responses and sanitize infrastructure failures.

## Not yet implemented

Full showcase seeding, remaining write quotas and request-rate enforcement,
settings, the full release acceptance journey, CI and deployment. The other three products
and portfolio hub remain unimplemented.

## Engagement and notifications

- Desired-state votes/follows are transactional and idempotent. State is read
  with one SQL snapshot; pending and merged feedback reject all engagement writes.
- Comments support replies, author edits, author/moderator deletion, tombstones,
  server-authorized controls, retained drafts and cursor pagination. Demo comment
  quota is 100, enforced under a workspace lock.
- Follower notifications exclude the actor and use unique event keys. Inbox and
  mark-read operations revalidate persisted membership and demo expiry.
- Vote/follow controls provide optimistic feedback with rollback and live
  announcements. Persona changes refresh server permissions and remount the
  discussion for the new member. HTTP endpoints require exact Origin for writes,
  bounded JSON where relevant, no-store responses and safe infrastructure errors.

## Moderation

- Private review queue, approve/close, persisted-role status/taxonomy updates,
  explicit merge confirmation containing both titles and source/target comparison.
- Serializable merge with workspace-first, ordered feedback locks; votes/follows
  deduplicate on target, merged sources reject edits, redirects flatten after
  repeated merges, and original comment authors/deletion state remain visible
  in paginated read-only history. Both source and target must be published.
- Activity contains safe IDs/status metadata, not deleted comment bodies.
  Status notifications are idempotent for unchanged status; merge notifications
  cover affected voters/followers and exclude the acting moderator.
- `node scripts/verify-persisted-moderation.mjs` passes four grouped real-browser
  checks: private pending submission then approval, merge/vote/history/redirect,
  persisted completed status, and 375/1440px automated accessibility/width checks.
  Screenshots were visually inspected; artifacts are in `.local/moderation-qa`.
- Run database tests separately with `MODERATION_DATABASE_TEST=1` and the same
  command pattern as engagement tests, targeting `src/test/moderation-database.test.ts`.

## Roadmap and releases

- Public feedback is grouped into five textual status sections with stable
  manual-rank/time/ID pagination; phone layouts stack sections vertically.
- Moderator-only drafts, optional summaries, safe Markdown, explicit timestamped
  publication, immutable published releases, completed-feedback links, and
  deduplicated follower notifications are persisted. Cross-workspace IDs and
  stale roles are rejected; demo publication respects expiry and the ten-entry cap.
- Editor retains selected links beyond the initial search page, refreshes saved
  drafts, keeps content on failures, and explains how to reconcile stale links.
- Independent specification and quality reviews were performed. The latter found
  a stale-link recovery issue; explicit recovery guidance and regression tests
  were added before re-review.
- `node scripts/verify-persisted-release.mjs` passes four grouped Chrome checks:
  completed roadmap, draft/publication persistence, follower release destination,
  and member permission controls. 375/1440px accessibility/overflow scans pass;
  screenshots were visually inspected in `.local/release-qa`.
- Repeated development hot reload exposed PostgreSQL pool accumulation. A
  process-global development pool now survives module reloads; a regression test
  verifies object reuse, and the persisted browser journey passes after restart.
- Feature verification lives across `src/components/roadmap`,
  `src/lib/changelog-http.test.ts`, and opt-in `src/test/roadmap-database.test.ts`;
  there are no tests directly under `src/features/roadmap`.

## Verification detail

Latest functional gate: 259 unit/component tests
passed. Separately, all 50 real PostgreSQL cases passed (17 foundations,
7 feedback, 9 engagement, 8 moderation, 8 roadmap/changelog, 1 release inbox). TypeScript,
ESLint and the webpack production build passed. The
dedicated database command correctly exited with failure when TEST_DATABASE_URL
was absent. Auth logging and malformed-URL validation have regression coverage
to prevent credentials appearing in errors.

Demo lifecycle and HTTP tests use repository doubles to isolate service rules.
They do not establish PostgreSQL transaction, cleanup-locking or foreign-key
correctness. Real database cases cover atomic creation rollback, isolated
memberships, a 101-workspace cleanup, a locked workspace, showcase exclusion,
mixed active/expired sessions, and repeat cleanup. All now pass locally.

Feedback service, component, HTTP and server-page integration tests run without
a database. They verify request/UI wiring, not PostgreSQL execution. The seven new
real feedback database cases cover persisted roles, tenant boundaries, private
demos, membership revocation, quota concurrency, literal search, and stable pagination. All pass.
Run this suite separately after the foundation database suite to
avoid its shared-table cleanup racing the existing suite's reset:

```sh
FEEDBACK_DATABASE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/test/feedback-database.test.ts
```

This command requires a configured TEST_DATABASE_URL. Without it, the suite skips;
that is not successful database verification. The existing `test:db` command
still runs only the foundation database suite.

Browser verification became available after the user approved it and the
permission environment changed. An isolated Chrome 152 profile ran 17 checks:
the production homepage, real feedback components with explicitly synthetic
data, desktop and 320/375px layouts, light/dark themes, long-title wrapping,
empty/validation/loading/quota/pending states, keyboard submission, field-link
focus and native GET filter navigation. No horizontal overflow was detected in
the tested normal-size views. Automated WCAG A/AA checks found no violations in
the scanned states. Screenshots were also visually inspected against the
approved Impeccable noticeboard direction; no production UI changes were needed.

The component fixture is outside the production app and uses mocked mutation
responses. It does not prove database persistence, workspace route authorization
in a browser, or successful demo creation. The actual unconfigured homepage
correctly displayed a recoverable demo failure. The 200% checks use CSS zoom,
not native browser zoom; real devices, native zoom and screen-reader acceptance
remain outstanding. Automated accessibility scans are not full WCAG certification.

Reproduce with an existing Chrome installation and a built app without configured
demo services (otherwise the homepage failure assertion does not apply):

```sh
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
# In a second terminal; runs a loopback-only component fixture on port 3101:
node scripts/verify-browser.mjs
```

Reports and screenshots are generated under ignored `.local/browser-qa/`.
The script uses a fresh browser context and closes it and the fixture server
after testing; it does not access existing browser profiles or download tools.

The new `scripts/verify-persisted-engagement.mjs` uses the live development server
and a fresh Chrome profile: create demo, publish as moderator, vote/follow and
reload, switch member, post/edit/reload a comment, switch moderator, read a
notification and reload, then verify a separate browser cannot read the demo.
All six grouped checks pass. Real discussion scans at 375/1440px found no
automated A/AA violations or horizontal overflow; screenshots were inspected.
Artifacts are ignored under `.local/persisted-qa/`. A combined seeded end-to-end
journey remains outstanding; individual moderation and release journeys now pass.

## Demo endpoints (not ready for public deployment)

`POST /api/demo/start` creates a temporary workspace and sets `signal-demo`.
`POST /api/demo/persona` accepts only `{ "persona": "member" | "moderator" }`.
Both require an exact Origin match with APP_URL and return only workspace IDs and
slugs. Persona switching retains the original expiry. No account owner persona
is created. Cookies are HTTP-only, SameSite=Lax, host-only, and Secure on HTTPS or
in production. Invalid credentials fail closed.

`GET /api/cron/cleanup-demo` requires the configured bearer CRON_SECRET and returns
only a deletion count. The local `demo:cleanup` command performs the same single
batch; repeat for a backlog. No scheduler or paid resource has been configured.
Database/configuration failures return a generic 503 without credential details.
Rate limits and the remaining write quotas are still required before exposing
these endpoints publicly. Feedback creation now enforces its 30-item demo quota;
comment and ten-entry changelog quotas are enforced; request-rate enforcement remains.

PostgreSQL 17.11 was checksum-verified and built into ignored `.local/postgres`,
without global installation. Two password-protected clusters listen only on
127.0.0.1:54329 and 54330. Random secrets are in ignored mode-0600 `.env.local`.
Database tests
are explicitly skipped without TEST_DATABASE_URL; skipped tests are not passes.
The dedicated `test:db` command fails if that variable is absent, preventing a
false-green database verification. SQL generation/checks are not proof that a
migration has successfully executed.

The copied dependencies retain old workspace metadata. While offline, use the
installed executables directly; do not delete dependencies or automatically
reinstall them:

```sh
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js
node node_modules/prettier/bin/prettier.cjs --check .
node node_modules/drizzle-kit/bin.cjs check
node node_modules/next/dist/bin/next build --webpack
```

The supported webpack build passes. A build alone does not validate browser
behavior or persisted workflows. No production secrets are needed to build.

## Local database and development startup

For this configured machine (does not replace data):

```sh
node scripts/local-database.mjs start
node --env-file=.env.local src/lib/db/cli.ts migrate
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100
```

`local-database.mjs init` initializes new project-local clusters and secrets only
when no existing cluster/config is present. It requires PostgreSQL binaries in
`.local/postgres/bin`. It refuses overwrites. Do not use production mode to
bypass HTTPS/SMTP checks for local development.

Alternatively, with Docker:

Copy `.env.example` to `.env.local` and replace all placeholders. Use independent
random secrets and a local-only PostgreSQL password; encode that password in the
two URLs. Never use a production database for tests.

```sh
docker compose --env-file .env.local up -d
node --env-file=.env.local src/lib/db/cli.ts migrate
node --env-file=.env.local src/lib/db/cli.ts test
```

The test command migrates and clears only the dedicated loopback `_test`
database, then verifies real foreign keys, uniqueness, cleanup and adapter calls.
`reset-test` intentionally clears test application data and must never be used
with an unrelated database. Development data is not reset by the tests.

After the foundation and feedback suites, run engagement tests separately:

```sh
ENGAGEMENT_DATABASE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/test/engagement-database.test.ts
node scripts/verify-persisted-engagement.mjs
```
