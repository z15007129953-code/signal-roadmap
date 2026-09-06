// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createEngagementHandlers } from "./engagement-http";
import { ok } from "./http/result";
function setup() {
  const engagement = {
    setVote: vi.fn().mockResolvedValue(ok({ voteCount: 1 })),
    createComment: vi.fn().mockResolvedValue(ok({ id: "comment" })),
    listComments: vi
      .fn()
      .mockResolvedValue(ok({ items: [], nextCursor: null })),
  };
  const loadContext = vi
    .fn()
    .mockResolvedValue(ok({ actor: null, workspace: { id: "w" }, engagement }));
  return {
    engagement,
    loadContext,
    handle: createEngagementHandlers({
      appUrl: "https://signal.test",
      loadContext,
    }),
  };
}
const request = (body: string, origin = "https://signal.test") =>
  new Request("https://signal.test/api", {
    method: "PUT",
    headers: { origin, "content-type": "application/json" },
    body,
  });
it("blocks cross-origin mutations before reading private context", async () => {
  const { handle, loadContext } = setup();
  expect(
    (await handle("vote", request("{}", "https://attacker.test"), "demo", "f"))
      .status,
  ).toBe(403);
  expect(loadContext).not.toHaveBeenCalled();
});
it("rejects malformed and oversized request bodies before storage", async () => {
  const { handle, loadContext } = setup();
  for (const body of ["{", JSON.stringify({ body: "x".repeat(66000) })])
    expect(
      (await handle("comment-create", request(body), "demo", "f")).status,
    ).toBe(422);
  expect(loadContext).not.toHaveBeenCalled();
});
it("routes desired state to the scoped service with no caching", async () => {
  const { handle, engagement } = setup();
  const response = await handle(
    "vote",
    request('{"active":true}'),
    "demo",
    "f",
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(engagement.setVote).toHaveBeenCalledWith(null, "w", "f", {
    active: true,
  });
});
it("keeps diagnostics private on repository failure", async () => {
  const { handle, loadContext } = setup();
  loadContext.mockRejectedValue(new Error("secret database password"));
  const response = await handle(
    "vote",
    request('{"active":true}'),
    "demo",
    "f",
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("password");
});
