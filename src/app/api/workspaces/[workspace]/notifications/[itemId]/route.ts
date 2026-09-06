import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/notifications/[itemId]">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "notification-read",
    request,
    p.workspace,
    undefined,
    p.itemId,
  );
}
