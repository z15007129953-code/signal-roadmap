import type { Result } from "@/lib/http/result";
import type { CommentItem, EngagementPageInput } from "./engagement-types";
import type { FeedbackActor, FeedbackItem, FeedbackStatus } from "./types";

export type ModerationStatusInput = { status: FeedbackStatus };
export type ModerationTaxonomyInput = { boardId: string; tagIds: string[] };
export type ModerationMergeInput = { targetId: string };
export type MergedHistoryItem = {
  sourceId: string;
  sourceTitle: string;
  sourceSlug: string;
  comment: CommentItem;
};
export type MergedHistoryPage = {
  items: MergedHistoryItem[];
  nextCursor: string | null;
};
export interface ModerationRepository {
  approve(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
  ): Promise<Result<FeedbackItem>>;
  reject(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
  ): Promise<Result<FeedbackItem>>;
  setStatus(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    input: ModerationStatusInput,
  ): Promise<Result<FeedbackItem>>;
  setTaxonomy(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    input: ModerationTaxonomyInput,
  ): Promise<Result<FeedbackItem>>;
  merge(
    actor: FeedbackActor,
    workspaceId: string,
    sourceId: string,
    input: ModerationMergeInput,
  ): Promise<Result<{ slug: string }>>;
  redirect(
    actor: FeedbackActor,
    workspaceId: string,
    slug: string,
  ): Promise<Result<{ slug: string } | null>>;
  taxonomySelection(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
  ): Promise<Result<{ tagIds: string[] }>>;
  history(
    actor: FeedbackActor,
    workspaceId: string,
    targetId: string,
    input: EngagementPageInput,
  ): Promise<Result<MergedHistoryPage>>;
}
