import { createLogoHandler } from "@/lib/storage/logo-http";
import { logoStorage } from "@/lib/storage/runtime";
import { loadSettingsContext } from "@/lib/settings-runtime";
import { getEnv } from "@/lib/env";
import { feedbackUnavailable } from "@/lib/feedback-http";
async function handle(request: Request) {
  try {
    return await createLogoHandler({
      appUrl: getEnv().APP_URL,
      loadContext: loadSettingsContext,
      storage: logoStorage,
    })(request);
  } catch {
    return feedbackUnavailable();
  }
}
export const POST = handle;
export const PATCH = handle;
