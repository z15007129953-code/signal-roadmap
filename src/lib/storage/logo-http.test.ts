// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createLogoHandler } from "./logo-http";
const appUrl = "https://signal.example";
const request = (body: unknown, method = "POST") =>
  new Request(`${appUrl}/api/uploads/logo`, {
    method,
    headers: { origin: appUrl, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("refuses moderator uploads before asking storage to sign", async () => {
  const storage = vi.fn();
  const handler = createLogoHandler({
    appUrl,
    storage,
    loadContext: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        actor: null,
        workspace: { id: "w" },
        settings: {
          get: async () => ({
            ok: true,
            value: { role: "moderator", isDemo: true },
          }),
        },
      },
    }),
  });
  expect(
    (await handler(request({ workspace: "demo", type: "image/png", size: 10 })))
      .status,
  ).toBe(403);
  expect(storage).not.toHaveBeenCalled();
});
it("checks the stored object before attaching it to a workspace", async () => {
  const setLogo = vi.fn();
  const verify = vi.fn().mockRejectedValue(Error("oversized"));
  const handler = createLogoHandler({
    appUrl,
    storage: vi.fn().mockReturnValue({ verify }),
    loadContext: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        actor: {},
        workspace: { id: "w" },
        settings: {
          get: async () => ({
            ok: true,
            value: { role: "owner", isDemo: false },
          }),
          setLogo,
        },
      },
    }),
  });
  expect(
    (await handler(request({ workspace: "team", key: "key" }, "PATCH"))).status,
  ).toBe(422);
  expect(setLogo).not.toHaveBeenCalled();
});
