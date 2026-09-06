import { handleChangelogRequest } from "@/lib/roadmap-runtime";
export async function GET(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/changelog/completed">,
) {
  const p = await context.params;
  return handleChangelogRequest("completed", request, p.workspace, undefined);
}
