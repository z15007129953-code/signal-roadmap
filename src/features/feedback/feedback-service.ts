import { z } from "zod";
import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import { requireWorkspace, requireRole } from "../auth/authorization";
import { createFeedbackSchema, feedbackFiltersSchema } from "./feedback-schema";
import type { FeedbackActor, FeedbackRepository } from "./types";

function boundary(actor: FeedbackActor, workspaceId: string) {
  if (!z.uuid().safeParse(workspaceId).success)
    return err(domainError("VALIDATION_FAILED"));
  return actor ? requireWorkspace(actor, workspaceId) : ok(null);
}
export function createFeedbackService(repository: FeedbackRepository) {
  return {
    async create(actor: FeedbackActor, workspaceId: string, input: unknown) {
      const scoped = boundary(actor, workspaceId);
      if (!scoped.ok) return scoped;
      const authenticated = requireWorkspace(actor, workspaceId);
      if (!authenticated.ok) return authenticated;
      const parsed = createFeedbackSchema.safeParse(input);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      return repository.create(authenticated.value, workspaceId, parsed.data);
    },
    async list(actor: FeedbackActor, workspaceId: string, filters: unknown) {
      const scoped = boundary(actor, workspaceId);
      if (!scoped.ok) return scoped;
      const parsed = feedbackFiltersSchema.safeParse(filters);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      if (parsed.data.visibility === "pending") {
        const moderator = requireRole(actor, "moderator");
        if (!moderator.ok) return moderator;
        return repository.listPending(actor, workspaceId, parsed.data);
      }
      return repository.listPublished(actor, workspaceId, parsed.data);
    },
    async detail(actor: FeedbackActor, workspaceId: string, slug: string) {
      const scoped = boundary(actor, workspaceId);
      if (!scoped.ok) return scoped;
      if (!/^[a-z0-9-]{1,200}$/.test(slug))
        return err(domainError("NOT_FOUND"));
      return repository.findBySlug(actor, workspaceId, slug);
    },
    async suggest(actor: FeedbackActor, workspaceId: string, title: unknown) {
      const scoped = boundary(actor, workspaceId);
      if (!scoped.ok) return scoped;
      const parsed = z.string().trim().max(140).safeParse(title);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      if (parsed.data.length < 3) return ok([]);
      return repository.searchSimilarTitles(actor, workspaceId, parsed.data);
    },
    async taxonomy(actor: FeedbackActor, workspaceId: string) {
      const scoped = boundary(actor, workspaceId);
      if (!scoped.ok) return scoped;
      return repository.taxonomy(actor, workspaceId);
    },
  };
}
