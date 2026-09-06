import "server-only";
import { withDiagnostics } from "./security/diagnostics";
import { createSettingsService } from "@/features/settings/settings-service";
import { createSettingsRepository } from "@/features/settings/settings-repository";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { loadFeedbackContext } from "./feedback-runtime";
import { ok } from "./http/result";
import { feedbackUnavailable } from "./feedback-http";
import { createSettingsHandler, type SettingsAction } from "./settings-http";
export function settingsService() {
  return createSettingsService(createSettingsRepository(getDatabase()));
}
export async function loadSettingsContext(slug: string) {
  const context = await loadFeedbackContext(slug);
  return context.ok
    ? ok({ ...context.value, settings: settingsService() })
    : context;
}
export async function handleSettingsRequest(
  action: SettingsAction,
  request: Request,
  slug: string,
  id?: string,
) {
  return withDiagnostics(request, async () => {
    try {
      return await createSettingsHandler({
        appUrl: getEnv().APP_URL,
        loadContext: loadSettingsContext,
      })(action, request, slug, id);
    } catch {
      return feedbackUnavailable();
    }
  });
}
