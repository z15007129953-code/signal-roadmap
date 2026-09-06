import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/comments/[itemId]">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "comment-edit",
    request,
    p.workspace,
    p.feedbackId,
    p.itemId,
  );
}
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/comments/[itemId]">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "comment-delete",
    request,
    p.workspace,
    p.feedbackId,
    p.itemId,
  );
}
