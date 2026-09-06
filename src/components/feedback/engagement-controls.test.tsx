import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EngagementControls } from "./engagement-controls";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const initial = { voteCount: 2, voted: false, following: false };
it("optimistically votes, then rolls back and announces a failed save", async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    ),
  );
  render(
    <EngagementControls
      workspace="demo"
      feedbackId="idea"
      initial={initial}
      canEngage
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Vote/ }));
  expect(screen.getByRole("button", { name: /Voted/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: /Voted/ })).toHaveTextContent("3");
  resolve(
    Response.json(
      { ok: false, error: { code: "DEMO_EXPIRED" } },
      { status: 410 },
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Vote/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("expired");
});
it("persists the desired follow state and announces success", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, value: { ...initial, following: true } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(
    <EngagementControls
      workspace="demo"
      feedbackId="idea"
      initial={initial}
      canEngage
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Follow updates" }));
  expect(fetcher).toHaveBeenCalledWith(
    "/api/workspaces/demo/feedback/idea/follow",
    expect.objectContaining({ method: "PUT", body: '{"active":true}' }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Following");
});
it("offers sign-in instead of anonymous write controls", () => {
  render(
    <EngagementControls
      workspace="demo"
      feedbackId="idea"
      initial={initial}
      canEngage={false}
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Sign in/ })).toHaveAttribute(
    "href",
    "/api/auth/signin",
  );
});
