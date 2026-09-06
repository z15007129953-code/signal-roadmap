// @vitest-environment node
import { expect, it, vi } from "vitest";
import { resolveFeedbackContext } from "./feedback-context";
import { ok, err } from "./http/result";
import { domainError } from "./http/errors";
import type { FeedbackRepository } from "@/features/feedback/types";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "demo",
  name: "Demo",
  description: null,
  isDemo: true,
};
it("never returns private demo metadata without a valid actor", async () => {
  const repository = {
    workspaceBySlug: vi.fn().mockResolvedValue(workspace),
  } as unknown as FeedbackRepository;
  const result = await resolveFeedbackContext("demo", repository, async () =>
    err(domainError("DEMO_EXPIRED")),
  );
  expect(result).toEqual(err(domainError("DEMO_EXPIRED")));
});
it("allows anonymous public workspaces but does not invent membership", async () => {
  const repository = {
    workspaceBySlug: vi.fn().mockResolvedValue({ ...workspace, isDemo: false }),
  } as unknown as FeedbackRepository;
  const result = await resolveFeedbackContext("demo", repository, async () =>
    err(domainError("UNAUTHENTICATED")),
  );
  expect(result.ok && result.value.actor).toBe(null);
});
it("passes trusted actor to the service context", async () => {
  const repository = {
    workspaceBySlug: vi.fn().mockResolvedValue(workspace),
  } as unknown as FeedbackRepository;
  const actor = {
    kind: "demo" as const,
    userId: null,
    memberId: "member",
    workspaceId: workspace.id,
    role: "member" as const,
  };
  const result = await resolveFeedbackContext("demo", repository, async () =>
    ok(actor),
  );
  expect(result.ok && result.value.actor).toEqual(actor);
});
