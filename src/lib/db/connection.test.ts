// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const { connect } = vi.hoisted(() => ({ connect: vi.fn(() => ({})) }));
vi.mock("postgres", () => ({ default: connect }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: (client: unknown) => ({ client }),
}));
vi.mock("../env.ts", () => ({
  getEnv: () => ({ DATABASE_URL: "postgres://localhost/signal" }),
}));
afterEach(() => {
  vi.resetModules();
});
it("reuses the development pool when modules reload", async () => {
  const first = await import("./index");
  const db = first.getDatabase();
  vi.resetModules();
  const second = await import("./index");
  expect(second.getDatabase()).toBe(db);
  expect(connect).toHaveBeenCalledOnce();
});
