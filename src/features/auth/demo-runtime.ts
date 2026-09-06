import "server-only";
import { withDiagnostics } from "@/lib/security/diagnostics";
import { getDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createDemoRepository } from "./demo-repository";
import { createDemoHandlers, unavailable } from "./demo-http";

export async function handleDemoRequest(
  action: "start" | "switchPersona" | "cleanup",
  request: Request,
) {
  return withDiagnostics(request, async () => {
    try {
      const env = getEnv();
      return await createDemoHandlers({
        repository: createDemoRepository(getDatabase()),
        secret: env.DEMO_COOKIE_SECRET,
        secure:
          env.NODE_ENV === "production" || env.APP_URL.startsWith("https:"),
        appUrl: env.APP_URL,
        cronSecret: env.CRON_SECRET,
      })[action](request);
    } catch {
      return unavailable();
    }
  });
}
