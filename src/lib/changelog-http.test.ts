// @vitest-environment node
import { expect, it, vi } from "vitest";
import { ok } from "./http/result";
import { createChangelogHandler } from "./changelog-http";
function setup() {
  const changelog = {
    create: vi.fn().mockResolvedValue(ok({ id: "e" })),
    publish: vi.fn().mockResolvedValue(ok({ id: "e" })),
    completed: vi.fn().mockResolvedValue(ok([])),
  };
  const loadContext = vi
    .fn()
    .mockResolvedValue(ok({ workspace: { id: "w" }, actor: null, changelog }));
  return {
    changelog,
    loadContext,
    handle: createChangelogHandler({
      appUrl: "https://signal.test",
      loadContext,
    }),
  };
}
const request = (body: string, origin = "https://signal.test") =>
  new Request("https://signal.test/api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
it("requires matching origin for draft creation and publication", async () => {
  const { handle, loadContext } = setup();
  for (const action of ["create", "publish"] as const)
    expect(
      (await handle(action, request("{}", "https://other.test"), "demo", "e"))
        .status,
    ).toBe(403);
  expect(loadContext).not.toHaveBeenCalled();
});
it("validates streamed bodies and saves through scoped services", async () => {
  const { handle, changelog } = setup();
  expect((await handle("create", request("{"), "demo")).status).toBe(422);
  const response = await handle(
    "create",
    request('{"title":"A release"}'),
    "demo",
  );
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(changelog.create).toHaveBeenCalledWith(null, "w", {
    title: "A release",
  });
});
it("publishes explicitly without requiring a fake JSON body", async () => {
  const { handle, changelog } = setup();
  const response = await handle(
    "publish",
    new Request("https://signal.test/api", {
      method: "POST",
      headers: { origin: "https://signal.test" },
    }),
    "demo",
    "entry",
  );
  expect(response.status).toBe(200);
  expect(changelog.publish).toHaveBeenCalledWith(null, "w", "entry");
});
