import { createFeedbackService } from "@/features/feedback/feedback-service";
import type {
  FeedbackActor,
  FeedbackRepository,
  FeedbackWorkspace,
} from "@/features/feedback/types";
import type { WorkspaceActor } from "@/features/auth/actor";
import { domainError } from "./http/errors";
import { err, ok, type Result } from "./http/result";
export type FeedbackContext = {
  workspace: FeedbackWorkspace;
  actor: FeedbackActor;
  service: ReturnType<typeof createFeedbackService>;
};
export async function resolveFeedbackContext(
  slug: string,
  repository: FeedbackRepository,
  getActor: (id: string) => Promise<Result<WorkspaceActor>>,
): Promise<Result<FeedbackContext>> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return err(domainError("NOT_FOUND"));
  const workspace = await repository.workspaceBySlug(slug);
  if (!workspace) return err(domainError("NOT_FOUND"));
  const identity = await getActor(workspace.id);
  if (!identity.ok && workspace.isDemo) return identity;
  if (identity.ok && identity.value.workspaceId !== workspace.id)
    return err(domainError("FORBIDDEN"));
  return ok({
    workspace,
    actor: identity.ok ? identity.value : null,
    service: createFeedbackService(repository),
  });
}
