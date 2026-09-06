// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createLogoStorage, createLogoClient } from "./r2";
import { securityHeaders } from "../security/headers";
const workspace = "00000000-0000-4000-8000-000000000001";
const key = `${workspace}/logos/00000000-0000-4000-8000-000000000002.png`;
it("keeps the actual signed upload origin inside the exact CSP allowlist", async () => {
  const account = "a".repeat(32);
  const client = createLogoClient({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const signed = await createLogoStorage(client, "signal-roadmap").prepare(
    workspace,
    { type: "image/png", size: 123 },
  );
  const origin = new URL(signed.url).origin;
  expect(origin).toBe(`https://${account}.r2.cloudflarestorage.com`);
  expect(
    securityHeaders({ production: true, nonce: "test", r2Account: account })[
      "Content-Security-Policy"
    ],
  ).toContain(origin);
});
function storage() {
  const client = createLogoClient({
    region: "auto",
    endpoint: "https://test.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const send = vi.spyOn(client, "send");
  return { api: createLogoStorage(client, "logos"), send };
}
it("signs a bounded scoped PUT without exposing permanent credentials", async () => {
  const { api } = storage();
  const signed = await api.prepare(workspace, { type: "image/png", size: 123 });
  expect(signed.key).toMatch(new RegExp(`^${workspace}/logos/`));
  expect(signed.headers).toEqual({ "Content-Type": "image/png" });
  const url = new URL(signed.url);
  expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
    "content-length",
  );
  expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
  expect(signed.url).not.toContain("secretAccessKey");
});
it("rejects foreign keys before accessing storage and checks actual stored size", async () => {
  const { api, send } = storage();
  await expect(api.verify(workspace, `foreign/${key}`)).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  send.mockResolvedValue({
    ContentLength: 2097153,
    ContentType: "image/png",
  } as never);
  await expect(api.verify(workspace, key)).rejects.toThrow();
  send.mockResolvedValue({
    ContentLength: 123,
    ContentType: "text/html",
  } as never);
  await expect(api.verify(workspace, key)).rejects.toThrow();
  send.mockResolvedValue({
    ContentLength: 123,
    ContentType: "image/png",
  } as never);
  await expect(api.verify(workspace, key)).resolves.toEqual({
    type: "image/png",
    size: 123,
  });
});
