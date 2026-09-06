# Database boundaries

`auth-schema.ts` defines the Auth.js adapter tables. `schema.ts` defines the tenant
domain and exports both sets for Drizzle. `index.ts` opens a connection lazily;
importing it does not connect to PostgreSQL or validate production secrets.

Every tenant child carries `workspaceId`. Associations use composite foreign keys
that include `workspaceId`; even a valid ID from another workspace is rejected.
Tenant slugs and vote/follow pairs have unique constraints. Notification delivery
is idempotent through `(recipientId, eventKey)`.

## Identities and demo personas

Application authors, voters, followers and notification recipients use **member
IDs**, not Auth.js user IDs. Resolve the signed-in Auth.js `user.id` through
`members(workspaceId, userId)` before domain writes. Auth.js users stay global;
workspace membership supplies the role and tenant boundary.

A demo session stores only a SHA-256 token hash and expiry. It may have one member
persona per role through `(workspaceId, demoSessionId, role)`. The demo service
must create permitted personas on the server, verify the signed cookie and token
expiry, and select a persisted persona by its validated session. A role or member
ID supplied by a client is never proof of authorization. No demo service is
implemented by this database foundation.

## Deletion policy

Deleting a workspace cascades all its tenant records. Deleting an Auth.js user
cascades auth accounts/sessions and anonymizes membership by clearing `userId`;
content remains attributed to the retained member display name. Removing a board
or member with authored content is rejected. Use archival/anonymization rather
than hard deletion for those records. Feedback deletion cascades its votes,
follows, comments, tags, redirects and notifications. Comment deletion is soft via
`deletedAt`; parent references prevent hard deletion while replies remain and
also prevent replies from referencing another feedback thread. Demo cleanup
deletes the expired demo workspace, not its session in isolation, since authored
personas must remain until the workspace is removed.

## Real database checks

Integration tests are skipped unless `TEST_DATABASE_URL` is explicitly supplied.
They migrate and reset only a loopback database ending in `_test`, then use real
PostgreSQL and the Auth.js Drizzle adapter. The reset helper checks the URL, actual
client host/port/database settings, and the live connection's database name. URL
parameters are rejected to prevent an override of the connection target. Docker
Compose publishes PostgreSQL 17 on loopback ports 54329 (development) and 54330
(test) and uses independent named volumes.
