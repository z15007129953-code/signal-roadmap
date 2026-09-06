import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function PUT(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/follow">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "follow",
    request,
    p.workspace,
    p.feedbackId,
    undefined,
  );
}
