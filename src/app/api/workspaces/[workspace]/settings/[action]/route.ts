import { handleSettingsRequest } from "@/lib/settings-runtime";
export async function POST(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/settings/[action]">,
) {
  const { workspace, action } = await context.params;
  if (
    action !== "branding" &&
    action !== "board" &&
    action !== "tag" &&
    action !== "role"
  )
    return new Response(null, { status: 404 });
  return handleSettingsRequest(action, request, workspace);
}
