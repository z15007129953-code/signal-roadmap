import { handleChangelogRequest } from "@/lib/roadmap-runtime";
export async function POST(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/changelog">,
) {
  const p = await context.params;
  return handleChangelogRequest("create", request, p.workspace, undefined);
}
