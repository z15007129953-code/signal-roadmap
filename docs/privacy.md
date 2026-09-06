# Privacy and retention

This document describes the implementation, not a promise that a public service
has already been deployed. A deployment operator must add their contact details
and actual provider/retention policies before inviting real customer data.

## Data stored

- Accounts: email, display name, verification metadata and database sessions.
- Workspaces: identity/branding, member roles, boards and tags.
- Participation: feedback, votes, comments, follows, in-app notifications and
  limited moderation activity metadata. Activity records do not retain deleted
  comment bodies.
- Demos: hashed random bearer, expiration, fictional personas and isolated data.
- Optional logos: a tenant-scoped object key plus the binary in R2.

Do not enter passwords, access tokens, private customer records or other secrets
in feedback or demo content. The sample workspace uses fictional names and
original example text. It is not evidence of actual customer adoption.

## Cookies and diagnostics

Authentication and demo cookies are necessary for the selected session. Demo
cookies are HTTP-only, host-only and SameSite=Lax; HTTPS uses Secure. A new demo
replaces the browser's previous demo credential. No advertising cookies or
third-party behavioral analytics are included.

Application diagnostics allow only bounded request IDs, fixed error codes and
HTTP statuses. They exclude cookies, bodies, email addresses, SQL, exceptions
and credentials. Development-only email sign-in links are an explicit local
exception; never expose development logs publicly.

Rate-limit identifiers are hashed. Only Vercel's overwritten ingress IP header
is accepted for anonymous IP limits on that platform; untrusted forwarding
headers are ignored elsewhere, where anonymous users share a conservative
bucket. Raw IPs are not written to the application database. Infrastructure
providers may maintain independent access logs under their own policies.

## Retention

Demo access expires after 24 hours. Cleanup removes at most 100 expired demo
workspaces per run and cascades their relational data; the canonical showcase
is excluded. Expiry is not immediate physical deletion. Daily scheduling and
backlogs can delay removal; operators must run additional batches as needed.

Normal workspace content persists until its authorized deletion or operator
retention process. Comments with replies may be soft-deleted to preserve thread
structure. Database backups follow the operator's provider policy. There is no
self-service account export/deletion flow in this phase; provide an operator
contact and a documented request process before collecting real account data.

Unattached/replaced R2 objects need an operator-configured cleanup policy. Do
not enable public uploads without validating that policy and storage limits.

## Limits of the demo

A workspace allows 30 feedback items, 100 comments, 10 changelog entries, 10
boards and 30 tags including seeded content. The seed leaves 9 feedback items,
76 comments and 7 releases available. A signed demo shares 60 requests per minute
across personas and dynamic reads/writes. Demo creation is separately limited
to five per anonymous source per hour. Public demo quotas are abuse controls,
not a guarantee of unlimited availability.
