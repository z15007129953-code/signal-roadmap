# Development status — 6 September 2026

Signal Roadmap is under active implementation. Feedback submission and discovery
are implemented in source, but the persisted end-to-end workflow has not been
validated on a running database. No GitHub repository or deployment has been published.

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
  queue, and private demo reads. Publishing/moderation actions come in a later task.
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
voting/comments/following, moderation actions, roadmap/changelog,
settings, browser acceptance tests, CI and deployment. The other three products
and portfolio hub remain unimplemented.

## Local verification and limitations

Latest gate: 210 tests passed, 24 database tests skipped; TypeScript, ESLint,
Prettier, migration consistency and the webpack production build passed. The
dedicated database command correctly exited with failure when TEST_DATABASE_URL
was absent. Auth logging and malformed-URL validation have regression coverage
to prevent credentials appearing in errors.

Demo lifecycle and HTTP tests use repository doubles to isolate service rules.
They do not establish PostgreSQL transaction, cleanup-locking or foreign-key
correctness. Real database cases cover atomic creation rollback, isolated
memberships, a 101-workspace cleanup, a locked workspace, showcase exclusion,
mixed active/expired sessions, and repeat cleanup. All remain unexecuted locally.

Feedback service, component, HTTP and server-page integration tests run without
a database. They verify request/UI wiring, not PostgreSQL execution. The seven new
real feedback database cases cover persisted roles, tenant boundaries, private
demos, membership revocation, quota concurrency, literal search, and stable pagination. They also remain
unexecuted. Run this suite separately after the foundation database suite to
avoid its shared-table cleanup racing the existing suite's reset:

```sh
FEEDBACK_DATABASE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/test/feedback-database.test.ts
```

This command requires a configured TEST_DATABASE_URL. Without it, the suite skips;
that is not successful database verification. The existing `test:db` command
still runs only the foundation database suite.

Browser visual acceptance is outstanding. A headless Chrome launch aborted
inside the sandbox; the isolated-browser permission request was rejected because
the automatic approval service returned HTTP 503. No alternate execution path
was used to bypass the rejection. Mobile layout, 200% zoom, light/dark screenshots
and real keyboard navigation must be checked in a permitted browser before
claiming the design is complete. The long-title component test checks full text
and wrap styling; it is not proof of rendered geometry.

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
comment/changelog quotas and request-rate constants are not yet enforced.

The current machine has no usable PostgreSQL or Docker runtime. Database tests
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

The standard Turbopack build needs a local worker port denied by this sandbox.
The supported webpack build runs without that local-port requirement; this does
not validate browser behavior or persisted workflows. No production secrets are
needed to build.

## Database setup when a local runtime is available

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

Downloading PostgreSQL was previously rejected because the automatic approval
service returned HTTP 503. No alternate download path was used to bypass that
rejection. Database provisioning and end-to-end verification remain outstanding.
