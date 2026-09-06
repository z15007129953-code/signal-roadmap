# Deployment runbook

Status: local implementation; no public deployment is claimed by this guide.
Use a server-capable host, not static export or GitHub Pages.

## Initial release

1. Publish under the intended GitHub account. Verify that no private environment
   files, databases, test traces or credentials are tracked.
2. Create separate Neon production/preview databases near the application region.
   Never give previews production write credentials. Test databases stay in CI.
3. Configure Upstash Redis. Missing settings, failures and timeouts deny traffic.
4. Configure SMTP and a verified sender. Test delivery and one-time link use
   on the exact deployed origin.
5. Import into Vercel, use Node 24, the pnpm lockfile and committed build command.
   Check current free-plan eligibility/limits. Never accept paid upgrades without
   approval.
6. Set `DATABASE_URL`, HTTPS `APP_URL` without a path, three independent secrets
   (`AUTH_SECRET`, `DEMO_COOKIE_SECRET`, `CRON_SECRET`), both SMTP fields and both
   Upstash fields in encrypted settings. Do not set `TEST_DATABASE_URL`, `E2E_RUN`
   or `NODE_ENV` overrides.
7. Leave all R2 fields unset initially. Demo uploads are forbidden regardless.
8. In a trusted operator environment using the intended production connection,
   run `pnpm db:migrate`, then `pnpm db:seed`. Confirm the selected database first.
   Do not migrate as a preview-build side effect or reset demos during deploys.
9. Deploy and run the checklist below. A build or screenshot alone is not a launch.

Keep secrets out of shell history, screenshots, repository files and support
messages. Login happens in the browser, never by sending passwords through chat.
Rotate anything accidentally exposed.

## Cleanup and capacity

`vercel.json` schedules `/api/cron/cleanup-demo` daily at 03:00 UTC. Vercel sends
`CRON_SECRET` as a bearer credential. Verify plan availability and actual runs
in the provider dashboard. Unauthenticated invocation must return 401.

Cleanup deletes at most 100 expired demo workspaces. A result of 100 may indicate
backlog: run `pnpm demo:cleanup` in a trusted operator environment until a batch
returns fewer than 100 and investigate sustained growth. Daily scheduling can
leave expired data for more than 24 hours; it remains inaccessible after expiry.
Provider backups have separate retention. Never promise immediate deletion.

Monitor database size, demo creation, cleanup failures, Redis availability and
provider quotas. No automatic paid upgrades are configured. Production never
falls back to development's in-memory rate limiter.

Only Vercel's overwritten ingress IP header is trusted. Other hosts use a shared
anonymous quota until an explicit trusted-proxy adapter is implemented/tested.

## Optional storage gate

Before enabling R2, use a dedicated bucket and least-privilege credentials,
restrict CORS to the exact app origin and required PUT headers, and test a signed
upload from the deployed browser. Path-style URLs match the account CSP origin.

Verify the 2 MB limit, MIME checks, tenant key isolation, metadata attachment and
sandboxed SVG response. Implement/verify cleanup for unused/replaced logos that
preserves current attachments; blanket expiry can break active logos. Database
demo cleanup does not clean storage. Keep uploads disabled until live browser,
retention and capacity checks pass.

## Production acceptance checklist

- Home, board, detail, roadmap and releases render without blank screens/browser
  errors on desktop and 390×844.
- Create a private demo, submit an idea and confirm pending state.
- Vote, comment and follow; reload and verify persistence.
- Become moderator, approve, merge the seeded pair and verify redirects,
  deduplicated supporters and preserved comment attribution.
- Complete an idea, publish a linked release and inspect the public views.
  Return to member and verify notifications.
- Test real SMTP sign-in and single-use links; unassigned accounts gain no roles.
- Check nonce CSP/security headers, correlated errors, cross-origin write denial
  and unauthorized cleanup rejection.
- Exercise Redis quotas/failure recovery in an isolated preview. Do not disrupt
  production Redis while users are active.
- Inspect a real scheduled cleanup and verify expired rows are removed.
- Confirm GitHub CI is green on the published commit. Record commit, public URL,
  CI run and actual results without sharing private session traces.

## Operations

Back up before schema changes. Committed SQL migrations have no automatic
destructive rollback. Revert app code only if compatible with the deployed
schema. Test backup restoration before accepting important data. Configure log
retention and an operator contact before inviting accounts/customer information.

Canonical personas are fictional attribution members. Sign-in does not create
an owner. Real membership provisioning is an explicit operator task, not a secret
URL or automatic elevation. See [privacy](privacy.md) for retention and limits.
