import { domainError } from "@/lib/http/errors";
import { err } from "@/lib/http/result";
import { engagementBoundary } from "../feedback/engagement-service";
import type { FeedbackActor } from "../feedback/types";
import {
  changelogInputSchema,
  changelogListSchema,
  changelogSlugSchema,
  completedQuerySchema,
} from "./schema";
import type { ChangelogRepository } from "./types";
export function createChangelogService(repository: ChangelogRepository) {
  const invalid = () => err(domainError("VALIDATION_FAILED"));
  return {
    async list(actor: FeedbackActor, w: string, input: unknown) {
      const allowed = engagementBoundary(actor, w);
      if (!allowed.ok) return allowed;
      const parsed = changelogListSchema.safeParse(input);
      return parsed.success
        ? repository.list(actor, w, parsed.data)
        : invalid();
    },
    async detail(actor: FeedbackActor, w: string, slug: string) {
      const allowed = engagementBoundary(actor, w);
      if (!allowed.ok) return allowed;
      return changelogSlugSchema.safeParse(slug).success
        ? repository.detail(actor, w, slug)
        : invalid();
    },
    async create(actor: FeedbackActor, w: string, input: unknown) {
      const allowed = engagementBoundary(actor, w, [], true);
      if (!allowed.ok) return allowed;
      const parsed = changelogInputSchema.safeParse(input);
      return parsed.success
        ? repository.create(actor, w, parsed.data)
        : invalid();
    },
    async update(actor: FeedbackActor, w: string, id: string, input: unknown) {
      const allowed = engagementBoundary(actor, w, [id], true);
      if (!allowed.ok) return allowed;
      const parsed = changelogInputSchema.safeParse(input);
      return parsed.success
        ? repository.update(actor, w, id, parsed.data)
        : invalid();
    },
    async publish(actor: FeedbackActor, w: string, id: string) {
      const allowed = engagementBoundary(actor, w, [id], true);
      return allowed.ok ? repository.publish(actor, w, id) : allowed;
    },
    async completed(actor: FeedbackActor, w: string, query: unknown = "") {
      const allowed = engagementBoundary(actor, w, [], true);
      if (!allowed.ok) return allowed;
      const parsed = completedQuerySchema.safeParse(query);
      return parsed.success
        ? repository.completed(actor, w, parsed.data)
        : invalid();
    },
  };
}
