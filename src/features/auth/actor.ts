export type WorkspaceRole = "member" | "moderator" | "owner";
type Membership = Readonly<{
  memberId: string;
  workspaceId: string;
  role: WorkspaceRole;
}>;
export type WorkspaceActor = Membership &
  (
    | Readonly<{ kind: "account"; userId: string }>
    | Readonly<{ kind: "demo"; userId: string | null }>
  );

/** Construct only from trusted server membership data, never a request body. */
export function createWorkspaceActor(actor: WorkspaceActor): WorkspaceActor {
  return Object.freeze({ ...actor });
}
