import { domainError } from "@/lib/http/errors";
import { err } from "@/lib/http/result";
import { engagementBoundary } from "./engagement-service";
import type { FeedbackActor } from "./types";
import type { ModerationRepository } from "./moderation-types";
import {
  moderationHistorySchema,
  moderationMergeSchema,
  moderationSlugSchema,
  moderationStatusSchema,
  moderationTaxonomySchema,
} from "./moderation-schema";
export function createModerationService(repository: ModerationRepository) {
  const simple = (
    kind: "approve" | "reject",
    actor: FeedbackActor,
    workspaceId: string,
    id: string,
  ) => {
    const boundary = engagementBoundary(actor, workspaceId, [id], true);
    return boundary.ok
      ? repository[kind](actor, workspaceId, id)
      : Promise.resolve(boundary);
  };
  return {
    approve: (a: FeedbackActor, w: string, id: string) =>
      simple("approve", a, w, id),
    reject: (a: FeedbackActor, w: string, id: string) =>
      simple("reject", a, w, id),
    async taxonomySelection(a: FeedbackActor, w: string, id: string) {
      const boundary = engagementBoundary(a, w, [id], true);
      return boundary.ok ? repository.taxonomySelection(a, w, id) : boundary;
    },
    async setStatus(a: FeedbackActor, w: string, id: string, input: unknown) {
      const boundary = engagementBoundary(a, w, [id], true);
      if (!boundary.ok) return boundary;
      const parsed = moderationStatusSchema.safeParse(input);
      return parsed.success
        ? repository.setStatus(a, w, id, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async setTaxonomy(a: FeedbackActor, w: string, id: string, input: unknown) {
      const boundary = engagementBoundary(a, w, [id], true);
      if (!boundary.ok) return boundary;
      const parsed = moderationTaxonomySchema.safeParse(input);
      return parsed.success
        ? repository.setTaxonomy(a, w, id, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async merge(a: FeedbackActor, w: string, id: string, input: unknown) {
      const boundary = engagementBoundary(a, w, [id], true);
      if (!boundary.ok) return boundary;
      const parsed = moderationMergeSchema.safeParse(input);
      return parsed.success && parsed.data.targetId !== id
        ? repository.merge(a, w, id, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async redirect(a: FeedbackActor, w: string, slug: string) {
      const boundary = engagementBoundary(a, w);
      if (!boundary.ok) return boundary;
      return moderationSlugSchema.safeParse(slug).success
        ? repository.redirect(a, w, slug)
        : err(domainError("VALIDATION_FAILED"));
    },
    async history(
      a: FeedbackActor,
      w: string,
      id: string,
      input: unknown = {},
    ) {
      const boundary = engagementBoundary(a, w, [id]);
      if (!boundary.ok) return boundary;
      const parsed = moderationHistorySchema.safeParse(input);
      return parsed.success
        ? repository.history(a, w, id, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
  };
}
