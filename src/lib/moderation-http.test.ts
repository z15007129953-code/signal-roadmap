// @vitest-environment node
import { expect, it, vi } from "vitest";
import { ok } from "./http/result";
import { createModerationHandler } from "./moderation-http";
function setup() {
  const moderation = {
    approve: vi.fn().mockResolvedValue(ok({ id: "f" })),
    merge: vi.fn().mockResolvedValue(ok({ slug: "target" })),
    setStatus: vi.fn().mockResolvedValue(ok({ id: "f" })),
    setTaxonomy: vi.fn().mockResolvedValue(ok({ id: "f" })),
  };
  const loadContext = vi
    .fn()
    .mockResolvedValue(ok({ workspace: { id: "w" }, actor: null, moderation }));
  return {
    moderation,
    loadContext,
    handle: createModerationHandler({
      appUrl: "https://signal.test",
      loadContext,
    }),
  };
}
const req = (input: unknown, origin = "https://signal.test") =>
  new Request("https://signal.test/api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
it("denies foreign origins and unknown actions without touching storage", async () => {
  const { handle, loadContext } = setup();
  expect(
    (
      await handle(
        req({ action: "approve" }, "https://other.test"),
        "demo",
        "f",
      )
    ).status,
  ).toBe(403);
  expect(
    (await handle(req({ action: "delete-everything" }), "demo", "f")).status,
  ).toBe(422);
  expect(loadContext).not.toHaveBeenCalled();
});
it("maps actions to the scoped moderation service", async () => {
  const { handle, moderation } = setup();
  const result = await handle(req({ action: "approve" }), "demo", "f");
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(moderation.approve).toHaveBeenCalledWith(null, "w", "f");
  await handle(req({ action: "merge", targetId: "target" }), "demo", "f");
  expect(moderation.merge).toHaveBeenCalledWith(null, "w", "f", {
    targetId: "target",
  });
});
it("sanitizes unexpected repository errors", async () => {
  const { handle, loadContext } = setup();
  loadContext.mockRejectedValue(new Error("secret token"));
  const response = await handle(req({ action: "approve" }), "demo", "f");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
