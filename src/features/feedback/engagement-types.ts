import type { Result } from "@/lib/http/result";
import type { FeedbackActor } from "./types";

export type EngagementState = {
  voteCount: number;
  voted: boolean;
  following: boolean;
};
export type CommentItem = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  canEdit: boolean;
  canDelete: boolean;
};
export type CommentInput = { body: string; parentId?: string | null };
export type EngagementPageInput = { limit: number; cursor?: string };
export type CommentPage = { items: CommentItem[]; nextCursor: string | null };
export interface EngagementRepository {
  state(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
  ): Promise<Result<EngagementState>>;
  setVote(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    active: boolean,
  ): Promise<Result<EngagementState>>;
  setFollow(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    active: boolean,
  ): Promise<Result<EngagementState>>;
  listComments(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    input: EngagementPageInput,
  ): Promise<Result<CommentPage>>;
  createComment(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    input: CommentInput,
  ): Promise<Result<CommentItem>>;
  editComment(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    commentId: string,
    input: { body: string },
  ): Promise<Result<CommentItem>>;
  deleteComment(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    commentId: string,
  ): Promise<Result<CommentItem>>;
}
