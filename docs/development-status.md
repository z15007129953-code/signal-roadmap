# Development status — 6 September 2026

Signal Roadmap is under active implementation. It is not yet a working feedback
portal or a deployed demo. No GitHub repository or deployment has been published.

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

## Not yet implemented

Full showcase seeding, quota and request-rate enforcement,
feedback/engagement/moderation workflows, roadmap/changelog,
settings, finished product screens, browser acceptance tests, CI and deployment.
The homepage is still the scaffold. The other three products and portfolio hub
remain unimplemented.

## Local verification and limitations

Latest gate: 161 tests passed, 17 database tests skipped; TypeScript, ESLint,
Prettier, migration consistency and the webpack production build passed. The
dedicated database command correctly exited with failure when TEST_DATABASE_URL
was absent. Auth logging and malformed-URL validation have regression coverage
to prevent credentials appearing in errors.

Demo lifecycle and HTTP tests use repository doubles to isolate service rules.
They do not establish PostgreSQL transaction, cleanup-locking or foreign-key
correctness. Real database cases cover atomic creation rollback, isolated
memberships, a 101-workspace cleanup, a locked workspace, showcase exclusion,
mixed active/expired sessions, and repeat cleanup. All remain unexecuted locally.

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
Rate limits and full write-quota enforcement are still required before exposing
these endpoints publicly; the quota constants alone do not enforce limits.

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
