import { handleSettingsRequest } from "@/lib/settings-runtime";
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/workspaces/[workspace]/settings/[action]/[itemId]">,
) {
  const { workspace, action, itemId } = await context.params;
  if (action !== "board" && action !== "tag")
    return new Response(null, { status: 404 });
  return handleSettingsRequest(
    action === "board" ? "deleteBoard" : "deleteTag",
    request,
    workspace,
    itemId,
  );
}
