# Architecture

Signal Roadmap is an independently authored modular monolith. Next.js renders
the application, PostgreSQL 17 stores its state, and domain services implement
the workflows. There is no copied upstream application or shared unpublished
package to install.

## Request boundaries

1. The request proxy assigns a random diagnostic ID, applies CSP/security
   headers, and enforces bounded route and caller quotas.
2. Pages and route handlers resolve the target workspace. Signed demo cookies
   or Auth.js database sessions identify the actor; roles are never accepted
   from request bodies.
3. Services validate inputs, permissions, visibility, expiry, and limits.
4. Workspace-scoped repositories own transactions and database queries.

Expected failures use typed results. Public API errors include a request ID.
Server page wrappers catch database failures before their raw SQL/parameters can
reach framework diagnostics, log an allowlisted event, and render a correlated
recovery page. Next routing exceptions are rethrown.

## Identity and authorization

Account sessions use Auth.js with the Drizzle adapter and short-lived email
sign-in links. Production requires SMTP. Only development may print sign-in
links to a local terminal. APP_URL pins the authentication origin.

Demo identity is a signed, HTTP-only, SameSite=Lax browser cookie. Its random
bearer is hashed in PostgreSQL. Switching between member and moderator changes
the signed persona but preserves the bearer, expiration, and request quota.
Each new demo has its own workspace and random content IDs. A demo cannot enter
another demo or receive owner permissions. Every mutation rechecks persisted
membership and locks the workspace before quota-sensitive changes.

Owners manage branding and member roles; moderators manage taxonomy, triage,
merges and releases; members participate in published discussions and submit
pending ideas. Published canonical showcase data is readable without a session.

## Transactions and ordering

Votes are unique per member and feedback. Merge locks both source and target,
unions supporters and followers, retains attributable comments as read-only
history, records a redirect, and prevents cycles or further source writes.
Status/merge/release notifications have idempotent recipient/event keys.

Roadmap columns and lists use bounded stable cursors. Published releases are
immutable, timestamped explicitly and may reference completed published ideas.
Last-owner changes and demo quotas serialize on a workspace lock.

## External adapters

- Upstash Redis: production rate limiting; missing configuration, network
  failure, and the SDK's fail-open timeout all deny the request. No memory
  fallback in production. Development uses a bounded in-memory map.
- SMTP: account verification email only; product event notifications are in-app.
- R2: optional owner logo upload, server-selected tenant key, maximum 2 MB,
  five-minute signed PUT, metadata verification before attachment, authorized
  same-origin read proxy. SVG receives a sandboxed content policy. Path-style
  addressing keeps signed upload origins inside the CSP allowlist.

Uploads require a separately verified retention/cleanup policy and live CORS
test before public enablement. Demo uploads are forbidden.

## Tests

Unit and component tests run with Vitest. Database suites opt in individually
and run sequentially against a dedicated loopback database ending in `_test`.
The foundation suite clears that database. Never run it concurrently with
another database or browser suite.

Playwright starts an isolated port-3200 application and build directory, resets
only the validated test database, and uses real persisted data. No browser write
in the acceptance journey is mocked. Local Chrome is used by default; CI uses
installed Chromium. These development-server checks do not replace the final
production smoke test with real SMTP, Redis and storage.
