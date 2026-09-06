import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceShell } from "../feedback/workspace-shell";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);
it("shows the saved workspace identity without substituting brand colors for text contrast", () => {
  render(
    <WorkspaceShell
      workspace={{
        id: "w",
        slug: "team",
        name: "Our team",
        description: "Clear decisions for everyone.",
        isDemo: false,
        logoKey: "w/logos/logo.png",
        accentColor: "#ffff00",
      }}
    >
      <h1>Feedback</h1>
    </WorkspaceShell>,
  );
  expect(screen.getByText("Clear decisions for everyone.")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Our team logo" })).toHaveAttribute(
    "src",
    "/api/workspaces/team/logo?v=w%2Flogos%2Flogo.png",
  );
});
it("requests a new logo when a refreshed workspace has a replacement key", () => {
  const workspace = {
    id: "w",
    slug: "team",
    name: "Our team",
    description: null,
    isDemo: false,
    logoKey: "w/logos/first.png",
  };
  const { rerender } = render(
    <WorkspaceShell workspace={workspace}>
      <h1>Feedback</h1>
    </WorkspaceShell>,
  );
  const previous = screen.getByRole("img").getAttribute("src");
  rerender(
    <WorkspaceShell workspace={{ ...workspace, logoKey: "w/logos/second.png" }}>
      <h1>Feedback</h1>
    </WorkspaceShell>,
  );
  expect(screen.getByRole("img").getAttribute("src")).not.toBe(previous);
  expect(screen.getByRole("img")).toHaveAttribute(
    "src",
    "/api/workspaces/team/logo?v=w%2Flogos%2Fsecond.png",
  );
});
