import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { DemoPersona } from "./demo-persona";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("switches the persisted persona and refreshes server permissions", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ ok: true, value: { slug: "demo" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<DemoPersona role="member" />);
  await userEvent.click(
    screen.getByRole("button", { name: "Try moderator view" }),
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/api/demo/persona",
    expect.objectContaining({ body: JSON.stringify({ persona: "moderator" }) }),
  );
  expect(refresh).toHaveBeenCalledOnce();
});
it("does not claim a role change on expiry or network failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "DEMO_EXPIRED" } },
          { status: 410 },
        ),
      ),
  );
  render(<DemoPersona role="moderator" />);
  await userEvent.click(
    screen.getByRole("button", { name: "Return to member view" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("expired");
  expect(refresh).not.toHaveBeenCalled();
});
