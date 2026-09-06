import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function PUT(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/vote">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "vote",
    request,
    p.workspace,
    p.feedbackId,
    undefined,
  );
}
