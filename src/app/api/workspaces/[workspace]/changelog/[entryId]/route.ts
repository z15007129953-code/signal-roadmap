import { handleChangelogRequest } from "@/lib/roadmap-runtime";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/changelog/[entryId]">,
) {
  const p = await context.params;
  return handleChangelogRequest("update", request, p.workspace, p.entryId);
}
