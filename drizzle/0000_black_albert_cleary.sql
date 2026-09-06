CREATE TYPE "public"."feedback_status" AS ENUM('under_review', 'planned', 'in_progress', 'completed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."feedback_visibility" AS ENUM('pending', 'published', 'merged');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'moderator', 'owner');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('status_changed', 'comment_added', 'feedback_merged');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"feedback_id" uuid,
	"changelog_entry_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "boards_workspace_slug" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cover_image_url" text,
	"summary" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_entries_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "changelog_workspace_slug" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
CREATE TABLE "changelog_feedback" (
	"workspace_id" uuid NOT NULL,
	"changelog_entry_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_feedback_workspace_id_changelog_entry_id_feedback_id_pk" PRIMARY KEY("workspace_id","changelog_entry_id","feedback_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_id" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "comments_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "comments_tenant_feedback_id" UNIQUE("workspace_id","feedback_id","id"),
	CONSTRAINT "comments_not_own_parent" CHECK ("comments"."id" <> "comments"."parent_id")
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "demo_sessions_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "demo_token_sha256" CHECK ("demo_sessions"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "feedback_status" DEFAULT 'under_review' NOT NULL,
	"visibility" "feedback_visibility" DEFAULT 'pending' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"manual_rank" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "feedback_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "feedback_workspace_slug" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
CREATE TABLE "feedback_redirects" (
	"workspace_id" uuid NOT NULL,
	"source_slug" text NOT NULL,
	"target_feedback_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_redirects_workspace_id_source_slug_pk" PRIMARY KEY("workspace_id","source_slug")
);
--> statement-breakpoint
CREATE TABLE "feedback_tags" (
	"workspace_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_tags_workspace_id_feedback_id_tag_id_pk" PRIMARY KEY("workspace_id","feedback_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"workspace_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_workspace_id_feedback_id_member_id_pk" PRIMARY KEY("workspace_id","feedback_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text,
	"demo_session_id" uuid,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "members_workspace_user" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "members_demo_persona" UNIQUE("workspace_id","demo_session_id","role"),
	CONSTRAINT "members_single_identity" CHECK (NOT ("members"."user_id" IS NOT NULL AND "members"."demo_session_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"feedback_id" uuid,
	"changelog_entry_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_key" text NOT NULL,
	CONSTRAINT "notifications_recipient_event" UNIQUE("recipient_id","event_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6E7568' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_tenant_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "tags_workspace_slug" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"workspace_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_workspace_id_feedback_id_member_id_pk" PRIMARY KEY("workspace_id","feedback_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"is_showcase" boolean DEFAULT false NOT NULL,
	"accent_color" text,
	"logo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_actor_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","actor_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_changelog_entry_id_changelog_entries_workspace_id_id_fk" FOREIGN KEY ("workspace_id","changelog_entry_id") REFERENCES "public"."changelog_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_workspace_id_author_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","author_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_feedback" ADD CONSTRAINT "changelog_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_feedback" ADD CONSTRAINT "changelog_feedback_workspace_id_changelog_entry_id_changelog_entries_workspace_id_id_fk" FOREIGN KEY ("workspace_id","changelog_entry_id") REFERENCES "public"."changelog_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_feedback" ADD CONSTRAINT "changelog_feedback_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_author_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","author_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_feedback_id_parent_id_comments_workspace_id_feedback_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id","parent_id") REFERENCES "public"."comments"("workspace_id","feedback_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workspace_id_board_id_boards_workspace_id_id_fk" FOREIGN KEY ("workspace_id","board_id") REFERENCES "public"."boards"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workspace_id_author_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","author_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_redirects" ADD CONSTRAINT "feedback_redirects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_redirects" ADD CONSTRAINT "feedback_redirects_workspace_id_target_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","target_feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_tags" ADD CONSTRAINT "feedback_tags_workspace_id_tag_id_tags_workspace_id_id_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "public"."tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_workspace_id_member_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","member_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_demo_session_id_demo_sessions_workspace_id_id_fk" FOREIGN KEY ("workspace_id","demo_session_id") REFERENCES "public"."demo_sessions"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_recipient_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","recipient_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_actor_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","actor_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_changelog_entry_id_changelog_entries_workspace_id_id_fk" FOREIGN KEY ("workspace_id","changelog_entry_id") REFERENCES "public"."changelog_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_workspace_id_feedback_id_feedback_workspace_id_id_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_workspace_id_member_id_members_workspace_id_id_fk" FOREIGN KEY ("workspace_id","member_id") REFERENCES "public"."members"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_workspace_created_idx" ON "activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "changelog_published_idx" ON "changelog_entries" USING btree ("workspace_id","published_at");--> statement-breakpoint
CREATE INDEX "comments_feedback_created_idx" ON "comments" USING btree ("workspace_id","feedback_id","created_at");--> statement-breakpoint
CREATE INDEX "demo_sessions_expiry_idx" ON "demo_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "feedback_workspace_status_idx" ON "feedback" USING btree ("workspace_id","status","visibility");--> statement-breakpoint
CREATE INDEX "feedback_workspace_created_idx" ON "feedback" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("workspace_id","recipient_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");