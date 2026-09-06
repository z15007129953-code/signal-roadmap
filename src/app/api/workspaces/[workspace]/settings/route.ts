import { handleSettingsRequest } from "@/lib/settings-runtime";
export async function GET(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/settings">,
) {
  const { workspace } = await context.params;
  return handleSettingsRequest("get", request, workspace);
}
