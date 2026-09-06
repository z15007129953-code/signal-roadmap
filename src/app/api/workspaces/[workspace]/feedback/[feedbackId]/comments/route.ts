import { handleEngagementRequest } from "@/lib/engagement-runtime";
export async function GET(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/comments">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "comments",
    request,
    p.workspace,
    p.feedbackId,
    undefined,
  );
}
export async function POST(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/feedback/[feedbackId]/comments">,
) {
  const p = await context.params;
  return handleEngagementRequest(
    "comment-create",
    request,
    p.workspace,
    p.feedbackId,
    undefined,
  );
}
