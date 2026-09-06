import { z } from "zod";
import { domainError } from "@/lib/http/errors";
import { err, type Result } from "@/lib/http/result";
import { engagementBoundary } from "../feedback/engagement-service";
import type { FeedbackActor } from "../feedback/types";
import {
  brandingSchema,
  boardSchema,
  tagSchema,
  memberQuerySchema,
  roleSchema,
  logoKeySchema,
} from "./settings-schema";
import type { SettingsRepository } from "./settings-types";
export function createSettingsService(repository: SettingsRepository) {
  async function validated<S extends z.ZodType, T>(
    actor: FeedbackActor,
    w: string,
    input: unknown,
    schema: S,
    call: (data: z.output<S>) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const boundary = engagementBoundary(actor, w, [], true);
    if (!boundary.ok) return boundary;
    const parsed = schema.safeParse(input);
    return parsed.success
      ? call(parsed.data)
      : err(domainError("VALIDATION_FAILED"));
  }
  return {
    get: (a: FeedbackActor, w: string, input: unknown = {}) =>
      validated(a, w, input, memberQuerySchema, (data) =>
        repository.get(a, w, data),
      ),
    branding: (a: FeedbackActor, w: string, input: unknown) =>
      validated(a, w, input, brandingSchema, (data) =>
        repository.branding(a, w, data),
      ),
    setLogo: (a: FeedbackActor, w: string, input: unknown) =>
      validated(a, w, input, logoKeySchema(w), (data) =>
        repository.setLogo(a, w, data),
      ),
    saveBoard: (a: FeedbackActor, w: string, input: unknown) =>
      validated(a, w, input, boardSchema, (data) =>
        repository.saveBoard(a, w, data),
      ),
    deleteBoard: (a: FeedbackActor, w: string, id: string) =>
      validated(a, w, id, z.uuid(), (data) =>
        repository.deleteBoard(a, w, data),
      ),
    saveTag: (a: FeedbackActor, w: string, input: unknown) =>
      validated(a, w, input, tagSchema, (data) =>
        repository.saveTag(a, w, data),
      ),
    deleteTag: (a: FeedbackActor, w: string, id: string) =>
      validated(a, w, id, z.uuid(), (data) => repository.deleteTag(a, w, data)),
    changeRole: (a: FeedbackActor, w: string, input: unknown) =>
      validated(a, w, input, roleSchema, (data) =>
        repository.changeRole(a, w, data),
      ),
  };
}
