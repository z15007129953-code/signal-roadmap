import "server-only";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { auth } from "./auth";
import { createIdentityRepository } from "./identity-repository";
import { resolveActor } from "./resolve-actor";

export const demoCookieName = "signal-demo";

/** The workspace ID must come from resolving the target resource, not a claimed role. */
export async function getCurrentActor(workspaceId: string) {
  const cookieStore = await cookies();
  return resolveActor(
    { workspaceId, demoCookie: cookieStore.get(demoCookieName)?.value },
    {
      repository: createIdentityRepository(getDatabase()),
      getUserId: async () => (await auth())?.user?.id ?? null,
      secret: getEnv().DEMO_COOKIE_SECRET,
    },
  );
}
