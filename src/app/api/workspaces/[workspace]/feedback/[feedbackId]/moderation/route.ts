import { handleModerationRequest } from "@/lib/moderation-runtime";
export async function POST(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/moderation">,
) {
  const { workspace, feedbackId } = await context.params;
  return handleModerationRequest(request, workspace, feedbackId);
}
