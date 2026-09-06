import { notFound } from "next/navigation";
import { loadSettingsContext } from "@/lib/settings-runtime";
import { getEnv } from "@/lib/env";
import {
  FeedbackAccessNotice,
  WorkspaceShell,
} from "@/components/feedback/workspace-shell";
import { SettingsPanel } from "@/components/settings/settings-panel";
export const dynamic = "force-dynamic";
export default async function SettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/admin/settings">) {
  const { workspace: slug } = await params;
  const context = await loadSettingsContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { actor, workspace, settings } = context.value;
  const query = await searchParams;
  const snapshot = await settings.get(actor, workspace.id, {
    ...(query.search ? { search: query.search } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  if (!snapshot.ok) return <FeedbackAccessNotice code={snapshot.error.code} />;
  return (
    <WorkspaceShell workspace={workspace} moderator>
      <div className="mb-8 grid gap-3">
        <h1 className="font-serif text-3xl">Workspace settings</h1>
        <p className="max-w-prose text-muted">
          Keep your noticeboard organized and make ownership clear.
        </p>
      </div>
      <SettingsPanel
        key={actor?.memberId}
        workspace={workspace.slug}
        initial={snapshot.value}
        storageAvailable={!!getEnv().R2_BUCKET}
        memberSearch={typeof query.search === "string" ? query.search : ""}
      />
    </WorkspaceShell>
  );
}
