// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createSettingsHandler } from "./settings-http";
const origin = "https://signal.example";
it("rejects foreign origins before loading identity", async () => {
  const loadContext = vi.fn();
  const handler = createSettingsHandler({ appUrl: origin, loadContext });
  const response = await handler(
    "branding",
    new Request(`${origin}/api`, {
      method: "POST",
      headers: { origin: "https://elsewhere.example" },
    }),
    "demo",
  );
  expect(response.status).toBe(403);
  expect(loadContext).not.toHaveBeenCalled();
});
it("passes only the resolved tenant to settings and preserves no-store responses", async () => {
  const branding = vi
    .fn()
    .mockResolvedValue({ ok: true, value: { name: "Team" } });
  const loadContext = vi.fn().mockResolvedValue({
    ok: true,
    value: {
      actor: null,
      workspace: { id: "trusted" },
      settings: { branding },
    },
  });
  const handler = createSettingsHandler({ appUrl: origin, loadContext });
  const response = await handler(
    "branding",
    new Request(`${origin}/api`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Team", workspaceId: "untrusted" }),
    }),
    "demo",
  );
  expect(branding).toHaveBeenCalledWith(null, "trusted", {
    name: "Team",
    workspaceId: "untrusted",
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("sanitizes infrastructure errors", async () => {
  const handler = createSettingsHandler({
    appUrl: origin,
    loadContext: vi.fn().mockRejectedValue(new Error("secret")),
  });
  const response = await handler("get", new Request(`${origin}/api`), "demo");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
