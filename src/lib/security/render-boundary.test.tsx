import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "request-1234" }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error === "redirect") throw error;
  },
}));
vi.mock("./request-id", () => ({
  requestId: () => "request-1234",
  logFailure: vi.fn(),
}));
import { safePage } from "./render-boundary";
it("contains raw rendering failures and returns a correlated recovery state", async () => {
  const page = safePage(async () => {
    throw Error("secret SQL user@example.com");
  });
  const result = await page({});
  expect(JSON.stringify(result)).toContain("request-1234");
  expect(JSON.stringify(result)).not.toContain("secret SQL");
});
it("preserves framework routing exceptions", async () => {
  await expect(
    safePage(async () => {
      throw "redirect";
    })({}),
  ).rejects.toBe("redirect");
});
