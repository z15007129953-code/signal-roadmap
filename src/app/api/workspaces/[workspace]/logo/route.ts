import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { withDiagnostics } from "@/lib/security/diagnostics";
import { logoStorage } from "@/lib/storage/runtime";
import { logoResponseHeaders } from "@/lib/storage/logo-policy";
import { feedbackUnavailable, respond } from "@/lib/feedback-http";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/logo">,
) {
  return withDiagnostics(_request, async () => {
    try {
      const { workspace: slug } = await context.params;
      const loaded = await loadFeedbackContext(slug);
      if (!loaded.ok) return respond(loaded);
      const { actor, workspace, service } = loaded.value;
      const allowed = await service.taxonomy(actor, workspace.id);
      if (!allowed.ok) return respond(allowed);
      if (!workspace.logoKey) return new Response(null, { status: 404 });
      const storage = logoStorage();
      if (!storage) return feedbackUnavailable();
      const logo = await storage.read(workspace.id, workspace.logoKey);
      return new Response(logo.stream, {
        headers: {
          ...logoResponseHeaders(logo.type),
          "Content-Length": String(logo.size),
        },
      });
    } catch {
      return feedbackUnavailable();
    }
  });
}
