import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import {
  createWorkspaceActor,
  type WorkspaceActor,
  type WorkspaceRole,
} from "./actor";
import { requireWorkspaceActor } from "./authorization";
import { hashDemoToken, verifyDemoToken, type DemoPersona } from "./demo-token";

type Membership = {
  memberId: string;
  workspaceId: string;
  userId: string | null;
  role: WorkspaceRole;
};
export interface IdentityRepository {
  findDemo(
    tokenHash: string,
    persona: DemoPersona,
  ): Promise<(Membership & { expiresAt: Date }) | null>;
  findAccount(userId: string, workspaceId: string): Promise<Membership | null>;
}

export async function resolveActor(
  input: { workspaceId: string; demoCookie?: string },
  dependencies: {
    repository: IdentityRepository;
    getUserId: () => Promise<string | null>;
    secret: string;
    now?: Date;
  },
): Promise<Result<WorkspaceActor>> {
  const { repository, secret } = dependencies;
  if (input.demoCookie !== undefined) {
    const credential = verifyDemoToken(input.demoCookie, secret);
    if (!credential) return err(domainError("UNAUTHENTICATED"));
    const member = await repository.findDemo(
      hashDemoToken(credential.token),
      credential.persona,
    );
    const now = dependencies.now ?? new Date();
    if (!member || !(member.expiresAt.getTime() > now.getTime()))
      return err(domainError("DEMO_EXPIRED"));
    if (
      member.workspaceId !== input.workspaceId ||
      member.role !== credential.persona
    )
      return err(domainError("FORBIDDEN"));
    return ok(
      createWorkspaceActor({
        kind: "demo",
        memberId: member.memberId,
        workspaceId: member.workspaceId,
        userId: null,
        role: member.role,
      }),
    );
  }
  const userId = await dependencies.getUserId();
  if (!userId) return err(domainError("UNAUTHENTICATED"));
  const member = await repository.findAccount(userId, input.workspaceId);
  if (
    !member ||
    member.workspaceId !== input.workspaceId ||
    member.userId !== userId
  )
    return err(domainError("FORBIDDEN"));
  const actor = createWorkspaceActor({ ...member, userId, kind: "account" });
  return requireWorkspaceActor(actor);
}
