import "server-only";
import { withDiagnostics } from "./security/diagnostics";
import { createRoadmapRepository } from "@/features/roadmap/roadmap-repository";
import { createRoadmapService } from "@/features/roadmap/roadmap-service";
import { createChangelogRepository } from "@/features/roadmap/changelog-repository";
import { createChangelogService } from "@/features/roadmap/changelog-service";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { loadFeedbackContext } from "./feedback-runtime";
import { ok } from "./http/result";
import { createChangelogHandler, type ChangelogAction } from "./changelog-http";
import { feedbackUnavailable } from "./feedback-http";
export function roadmapServices() {
  const db = getDatabase();
  return {
    roadmap: createRoadmapService(createRoadmapRepository(db)),
    changelog: createChangelogService(createChangelogRepository(db)),
  };
}
export async function handleChangelogRequest(
  action: ChangelogAction,
  request: Request,
  slug: string,
  id?: string,
) {
  return withDiagnostics(request, async () => {
    try {
      return await createChangelogHandler({
        appUrl: getEnv().APP_URL,
        loadContext: async (slug) => {
          const context = await loadFeedbackContext(slug);
          return context.ok
            ? ok({ ...context.value, ...roadmapServices() })
            : context;
        },
      })(action, request, slug, id);
    } catch {
      return feedbackUnavailable();
    }
  });
}
