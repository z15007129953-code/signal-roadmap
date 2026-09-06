import { domainError } from "@/lib/http/errors";
import { err } from "@/lib/http/result";
import { engagementBoundary } from "../feedback/engagement-service";
import type { FeedbackActor } from "../feedback/types";
import { roadmapListSchema } from "./schema";
import type { RoadmapRepository } from "./types";
export function createRoadmapService(repository: RoadmapRepository) {
  return {
    async list(actor: FeedbackActor, w: string, input: unknown) {
      const allowed = engagementBoundary(actor, w);
      if (!allowed.ok) return allowed;
      const parsed = roadmapListSchema.safeParse(input);
      return parsed.success
        ? repository.list(actor, w, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
  };
}
