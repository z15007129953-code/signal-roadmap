import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { DemoStart } from "./demo-start";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("creates an isolated demo and offers its scoped board link", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: true, value: { workspaceId: "id", slug: "demo-123" } },
          { status: 201 },
        ),
      ),
  );
  render(<DemoStart />);
  await userEvent.click(
    screen.getByRole("button", { name: "Start a private demo" }),
  );
  expect(
    await screen.findByRole("link", { name: "Open your feedback board" }),
  ).toHaveAttribute("href", "/demo-123/feedback");
});
it("shows a recoverable error when demo setup fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<DemoStart />);
  await userEvent.click(
    screen.getByRole("button", { name: "Start a private demo" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not be created",
  );
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(
    screen.getByRole("button", { name: "Start a private demo" }),
  ).toBeEnabled();
});
it("explains rate limits without claiming a new demo was created", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          ok: false,
          error: { code: "RATE_LIMITED", requestId: "request-1234" },
        },
        { status: 429, headers: { "Retry-After": "120" } },
      ),
    ),
  );
  render(<DemoStart />);
  await userEvent.click(
    screen.getByRole("button", { name: "Start a private demo" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("120 seconds");
  expect(
    screen.queryByRole("link", { name: "Open your feedback board" }),
  ).not.toBeInTheDocument();
});
