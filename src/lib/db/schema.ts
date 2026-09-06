import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  type ForeignKeyBuilder,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema.ts";

export {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "./auth-schema.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());
const id = () => uuid("id").defaultRandom().primaryKey();
const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });
const tenantReference = (
  workspace: AnyPgColumn,
  column: AnyPgColumn,
  target: { workspaceId: AnyPgColumn; id: AnyPgColumn },
  onDelete: "cascade" | "no action" = "cascade",
) =>
  foreignKey({
    columns: [workspace, column],
    foreignColumns: [target.workspaceId, target.id],
  }).onDelete(onDelete);

export const memberRole = pgEnum("member_role", [
  "member",
  "moderator",
  "owner",
]);
export const feedbackStatus = pgEnum("feedback_status", [
  "under_review",
  "planned",
  "in_progress",
  "completed",
  "closed",
]);
export const feedbackVisibility = pgEnum("feedback_visibility", [
  "pending",
  "published",
  "merged",
]);
export const notificationType = pgEnum("notification_type", [
  "status_changed",
  "comment_added",
  "feedback_merged",
  "changelog_published",
]);

export const workspaces = pgTable("workspaces", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isDemo: boolean("is_demo").default(false).notNull(),
  isShowcase: boolean("is_showcase").default(false).notNull(),
  accentColor: text("accent_color"),
  logoKey: text("logo_key"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const demoSessions = pgTable(
  "demo_sessions",
  {
    id: id(),
    workspaceId: workspaceId(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("demo_sessions_tenant_id").on(table.workspaceId, table.id),
    index("demo_sessions_expiry_idx").on(table.expiresAt),
    check("demo_token_sha256", sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const members = pgTable(
  "members",
  {
    id: id(),
    workspaceId: workspaceId(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    demoSessionId: uuid("demo_session_id"),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    role: memberRole("role").default("member").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("members_tenant_id").on(table.workspaceId, table.id),
    unique("members_workspace_user").on(table.workspaceId, table.userId),
    unique("members_demo_persona").on(
      table.workspaceId,
      table.demoSessionId,
      table.role,
    ),
    tenantReference(table.workspaceId, table.demoSessionId, demoSessions),
    check(
      "members_single_identity",
      sql`NOT (${table.userId} IS NOT NULL AND ${table.demoSessionId} IS NOT NULL)`,
    ),
  ],
);
export const boards = pgTable(
  "boards",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    position: integer("position").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("boards_tenant_id").on(table.workspaceId, table.id),
    unique("boards_workspace_slug").on(table.workspaceId, table.slug),
  ],
);
export const tags = pgTable(
  "tags",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color").default("#6E7568").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("tags_tenant_id").on(table.workspaceId, table.id),
    unique("tags_workspace_slug").on(table.workspaceId, table.slug),
  ],
);
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    workspaceId: workspaceId(),
    boardId: uuid("board_id").notNull(),
    authorId: uuid("author_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: feedbackStatus("status").default("under_review").notNull(),
    visibility: feedbackVisibility("visibility").default("pending").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    manualRank: integer("manual_rank").default(0).notNull(),
  },
  (table) => [
    unique("feedback_tenant_id").on(table.workspaceId, table.id),
    unique("feedback_workspace_slug").on(table.workspaceId, table.slug),
    tenantReference(table.workspaceId, table.boardId, boards, "no action"),
    tenantReference(table.workspaceId, table.authorId, members, "no action"),
    index("feedback_workspace_status_idx").on(
      table.workspaceId,
      table.status,
      table.visibility,
    ),
    index("feedback_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
export const feedbackTags = pgTable(
  "feedback_tags",
  {
    workspaceId: workspaceId(),
    feedbackId: uuid("feedback_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.feedbackId, table.tagId] }),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(table.workspaceId, table.tagId, tags),
  ],
);
export const votes = pgTable(
  "votes",
  {
    workspaceId: workspaceId(),
    feedbackId: uuid("feedback_id").notNull(),
    memberId: uuid("member_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.feedbackId, table.memberId],
    }),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(table.workspaceId, table.memberId, members),
  ],
);
export const comments = pgTable(
  "comments",
  {
    id: id(),
    workspaceId: workspaceId(),
    feedbackId: uuid("feedback_id").notNull(),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    parentId: uuid("parent_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("comments_tenant_id").on(table.workspaceId, table.id),
    unique("comments_tenant_feedback_id").on(
      table.workspaceId,
      table.feedbackId,
      table.id,
    ),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(table.workspaceId, table.authorId, members, "no action"),
    ((): ForeignKeyBuilder =>
      foreignKey({
        columns: [table.workspaceId, table.feedbackId, table.parentId],
        foreignColumns: [
          comments.workspaceId,
          comments.feedbackId,
          comments.id,
        ],
      }).onDelete("no action"))(),
    check("comments_not_own_parent", sql`${table.id} <> ${table.parentId}`),
    index("comments_feedback_created_idx").on(
      table.workspaceId,
      table.feedbackId,
      table.createdAt,
    ),
  ],
);
export const follows = pgTable(
  "follows",
  {
    workspaceId: workspaceId(),
    feedbackId: uuid("feedback_id").notNull(),
    memberId: uuid("member_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.feedbackId, table.memberId],
    }),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(table.workspaceId, table.memberId, members),
  ],
);
export const feedbackRedirects = pgTable(
  "feedback_redirects",
  {
    workspaceId: workspaceId(),
    sourceSlug: text("source_slug").notNull(),
    targetFeedbackId: uuid("target_feedback_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.sourceSlug] }),
    tenantReference(table.workspaceId, table.targetFeedbackId, feedback),
  ],
);
export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: id(),
    workspaceId: workspaceId(),
    authorId: uuid("author_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    coverImageUrl: text("cover_image_url"),
    summary: text("summary").default("").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("changelog_entries_tenant_id").on(table.workspaceId, table.id),
    unique("changelog_workspace_slug").on(table.workspaceId, table.slug),
    tenantReference(table.workspaceId, table.authorId, members, "no action"),
    index("changelog_published_idx").on(table.workspaceId, table.publishedAt),
  ],
);
export const changelogFeedback = pgTable(
  "changelog_feedback",
  {
    workspaceId: workspaceId(),
    changelogEntryId: uuid("changelog_entry_id").notNull(),
    feedbackId: uuid("feedback_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.changelogEntryId, table.feedbackId],
    }),
    tenantReference(
      table.workspaceId,
      table.changelogEntryId,
      changelogEntries,
    ),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
  ],
);
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: workspaceId(),
    recipientId: uuid("recipient_id").notNull(),
    actorId: uuid("actor_id"),
    feedbackId: uuid("feedback_id"),
    changelogEntryId: uuid("changelog_entry_id"),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
    eventKey: text("event_key").notNull(),
  },
  (table) => [
    unique("notifications_recipient_event").on(
      table.recipientId,
      table.eventKey,
    ),
    tenantReference(table.workspaceId, table.recipientId, members),
    tenantReference(table.workspaceId, table.actorId, members, "no action"),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(
      table.workspaceId,
      table.changelogEntryId,
      changelogEntries,
    ),
    index("notifications_inbox_idx").on(
      table.workspaceId,
      table.recipientId,
      table.readAt,
      table.createdAt,
    ),
  ],
);
export const activity = pgTable(
  "activity",
  {
    id: id(),
    workspaceId: workspaceId(),
    actorId: uuid("actor_id"),
    feedbackId: uuid("feedback_id"),
    changelogEntryId: uuid("changelog_entry_id"),
    action: text("action").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    tenantReference(table.workspaceId, table.actorId, members, "no action"),
    tenantReference(table.workspaceId, table.feedbackId, feedback),
    tenantReference(
      table.workspaceId,
      table.changelogEntryId,
      changelogEntries,
    ),
    index("activity_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
