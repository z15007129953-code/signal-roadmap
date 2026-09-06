import type { WorkspaceActor } from "../auth/actor";
import type { Result } from "@/lib/http/result";

export type FeedbackStatus =
  "under_review" | "planned" | "in_progress" | "completed" | "closed";
export type FeedbackItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: FeedbackStatus;
  visibility: "pending" | "published" | "merged";
  createdAt: Date;
  authorId: string;
  boardId: string;
};
export type FeedbackInput = {
  title: string;
  description: string;
  boardId: string;
  tagIds: string[];
};
export type FeedbackCursor = { createdAt: string; id: string };
export type FeedbackFilters = {
  boardId?: string;
  tagId?: string;
  status?: FeedbackStatus;
  query?: string;
  visibility: "published" | "pending";
  cursor?: string;
  limit: number;
};
export type FeedbackPage = { items: FeedbackItem[]; nextCursor: string | null };
export type FeedbackTaxonomy = {
  boards: { id: string; name: string }[];
  tags: { id: string; name: string }[];
};
export type FeedbackWorkspace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isDemo: boolean;
  logoKey?: string | null;
  accentColor?: string | null;
};
export type FeedbackActor = WorkspaceActor | null | undefined;
/** Implementations authorize using current persisted membership on every read/write. */
export interface FeedbackRepository {
  workspaceBySlug(slug: string): Promise<FeedbackWorkspace | null>;
  create(
    actor: WorkspaceActor,
    workspaceId: string,
    input: FeedbackInput,
  ): Promise<Result<FeedbackItem>>;
  findBySlug(
    actor: FeedbackActor,
    workspaceId: string,
    slug: string,
  ): Promise<Result<FeedbackItem>>;
  listPublished(
    actor: FeedbackActor,
    workspaceId: string,
    filters: FeedbackFilters,
  ): Promise<Result<FeedbackPage>>;
  listPending(
    actor: FeedbackActor,
    workspaceId: string,
    filters: FeedbackFilters,
  ): Promise<Result<FeedbackPage>>;
  searchSimilarTitles(
    actor: FeedbackActor,
    workspaceId: string,
    title: string,
  ): Promise<Result<FeedbackItem[]>>;
  taxonomy(
    actor: FeedbackActor,
    workspaceId: string,
  ): Promise<Result<FeedbackTaxonomy>>;
}
