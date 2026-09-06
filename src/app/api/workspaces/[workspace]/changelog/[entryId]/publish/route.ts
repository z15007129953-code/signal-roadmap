import { handleChangelogRequest } from "@/lib/roadmap-runtime";
export async function POST(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/changelog/[entryId]/publish">,
) {
  const p = await context.params;
  return handleChangelogRequest("publish", request, p.workspace, p.entryId);
}
