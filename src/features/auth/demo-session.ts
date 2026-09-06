import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import {
  createDemoToken,
  hashDemoToken,
  signDemoToken,
  verifyDemoToken,
  type DemoPersona,
} from "./demo-token";

export const demoCookieName = "signal-demo";
export const demoQuota = Object.freeze({
  feedback: 30,
  comments: 100,
  changelogEntries: 10,
  requestsPerMinute: 60,
});
type Workspace = { workspaceId: string; slug: string };
export interface DemoRepository {
  create(input: { tokenHash: string; expiresAt: Date }): Promise<Workspace>;
  findPersona(
    tokenHash: string,
    persona: DemoPersona,
  ): Promise<(Workspace & { expiresAt: Date }) | null>;
  deleteExpiredBatch(now: Date, limit: number): Promise<number>;
}
type Dependencies = {
  repository: DemoRepository;
  secret: string;
  secure: boolean;
  now?: Date;
};

function cookie(value: string, expires: Date, secure: boolean) {
  return {
    name: demoCookieName,
    value,
    expires,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createDemoSession({
  repository,
  secret,
  secure,
  now = new Date(),
}: Dependencies) {
  const token = createDemoToken();
  const value = signDemoToken(token, "member", secret);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const workspace = await repository.create({
    tokenHash: hashDemoToken(token),
    expiresAt,
  });
  return { workspace, cookie: cookie(value, expiresAt, secure) };
}

export async function switchDemoPersona(
  value: string,
  persona: unknown,
  { repository, secret, secure, now = new Date() }: Dependencies,
) {
  if (persona !== "member" && persona !== "moderator")
    return err(domainError("VALIDATION_FAILED"));
  const credential = verifyDemoToken(value, secret);
  if (!credential) return err(domainError("UNAUTHENTICATED"));
  const workspace = await repository.findPersona(
    hashDemoToken(credential.token),
    persona,
  );
  if (!workspace || !(workspace.expiresAt.getTime() > now.getTime()))
    return err(domainError("DEMO_EXPIRED"));
  return ok({
    workspace: { workspaceId: workspace.workspaceId, slug: workspace.slug },
    cookie: cookie(
      signDemoToken(credential.token, persona, secret),
      workspace.expiresAt,
      secure,
    ),
  });
}

export async function cleanupDemoSessions(
  repository: DemoRepository,
  now = new Date(),
) {
  return { deleted: await repository.deleteExpiredBatch(now, 100) };
}
