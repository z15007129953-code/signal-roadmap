// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createFeedbackHandlers } from "./feedback-http";
import { ok, err } from "./http/result";
import { domainError } from "./http/errors";
import type { FeedbackContext } from "./feedback-context";

function setup() {
  const service = {
    create: vi.fn().mockResolvedValue(ok({ slug: "new-idea" })),
    suggest: vi.fn().mockResolvedValue(ok([])),
  };
  const load = vi
    .fn()
    .mockResolvedValue(
      ok({ workspace: { id: "workspace" }, actor: null, service }),
    );
  return {
    service,
    load,
    handlers: createFeedbackHandlers({
      appUrl: "https://signal.test",
      loadContext: load as () => Promise<
        ReturnType<typeof ok<FeedbackContext>>
      >,
    }),
  };
}
function request(body: string, origin = "https://signal.test") {
  return new Request("https://signal.test/api/workspaces/demo/feedback", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}
it("rejects cross-origin creation before touching storage", async () => {
  const { handlers, load } = setup();
  expect(
    (await handlers.create(request("{}", "https://other.test"), "demo")).status,
  ).toBe(403);
  expect(load).not.toHaveBeenCalled();
});
it("rejects oversized streamed JSON and malformed bodies", async () => {
  const { handlers, service } = setup();
  expect(
    (
      await handlers.create(
        request(JSON.stringify({ body: "x".repeat(66000) })),
        "demo",
      )
    ).status,
  ).toBe(422);
  expect((await handlers.create(request("{"), "demo")).status).toBe(422);
  expect(service.create).not.toHaveBeenCalled();
});
it("creates through scoped service and disables response caching", async () => {
  const { handlers, service } = setup();
  const response = await handlers.create(request('{"title":"Hello"}'), "demo");
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(service.create).toHaveBeenCalledWith(null, "workspace", {
    title: "Hello",
  });
});
it("does not leak private context or diagnostics on failure", async () => {
  const { handlers, load } = setup();
  load.mockResolvedValueOnce(err(domainError("DEMO_EXPIRED")));
  expect(
    (
      await handlers.suggest(
        new Request("https://signal.test/?title=idea"),
        "demo",
      )
    ).status,
  ).toBe(410);
  load.mockRejectedValueOnce(new Error("postgres secret password"));
  const response = await handlers.create(request("{}"), "demo");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("password");
});
it("passes suggestion title literally and keeps reads private", async () => {
  const { handlers, service } = setup();
  const response = await handlers.suggest(
    new Request("https://signal.test/?title=%25_export"),
    "demo",
  );
  expect(service.suggest).toHaveBeenCalledWith(null, "workspace", "%_export");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
