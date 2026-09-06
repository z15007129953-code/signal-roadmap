import type { Result } from "@/lib/http/result";
import type {
  FeedbackActor,
  FeedbackItem,
  FeedbackStatus,
} from "../feedback/types";

export type RoadmapItem = FeedbackItem & {
  manualRank: number;
  updatedAt: Date;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type RoadmapListInput = {
  status: FeedbackStatus;
  cursor?: string;
  limit?: number;
};
export type ChangelogListInput = {
  visibility: "published" | "draft";
  cursor?: string;
  limit?: number;
};
export type ChangelogInput = {
  title: string;
  summary: string;
  body: string;
  feedbackIds: string[];
};
export type CompletedFeedback = { id: string; title: string; slug: string };
export type ChangelogItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  authorId: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  feedback: CompletedFeedback[];
};
export interface RoadmapRepository {
  list(
    actor: FeedbackActor,
    workspaceId: string,
    input: RoadmapListInput,
  ): Promise<Result<Page<RoadmapItem>>>;
}
export interface ChangelogRepository {
  list(
    actor: FeedbackActor,
    workspaceId: string,
    input: ChangelogListInput,
  ): Promise<Result<Page<ChangelogItem>>>;
  detail(
    actor: FeedbackActor,
    workspaceId: string,
    slug: string,
  ): Promise<Result<ChangelogItem>>;
  create(
    actor: FeedbackActor,
    workspaceId: string,
    input: ChangelogInput,
  ): Promise<Result<ChangelogItem>>;
  update(
    actor: FeedbackActor,
    workspaceId: string,
    id: string,
    input: ChangelogInput,
  ): Promise<Result<ChangelogItem>>;
  publish(
    actor: FeedbackActor,
    workspaceId: string,
    id: string,
  ): Promise<Result<ChangelogItem>>;
  completed(
    actor: FeedbackActor,
    workspaceId: string,
    query?: string,
  ): Promise<Result<CompletedFeedback[]>>;
}
