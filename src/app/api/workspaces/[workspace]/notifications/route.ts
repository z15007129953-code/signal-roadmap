import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function GET(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/notifications">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "notifications",
    request,
    p.workspace,
    undefined,
    undefined,
  );
}
