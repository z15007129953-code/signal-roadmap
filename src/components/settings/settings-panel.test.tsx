import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPanel } from "./settings-panel";
import type { SettingsSnapshot } from "@/features/settings/settings-types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const initial: SettingsSnapshot = {
  workspace: {
    id: "w",
    name: "Our team",
    description: null,
    accentColor: null,
    logoKey: null,
  },
  role: "moderator",
  isDemo: true,
  boards: [],
  tags: [],
  members: { items: [], nextCursor: null },
};
it("keeps owner controls unavailable in moderator demos", () => {
  render(
    <SettingsPanel
      workspace="demo"
      initial={initial}
      storageAvailable={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Save branding" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Boards" })).toBeInTheDocument();
  expect(screen.getByText(/Only a workspace owner/)).toBeInTheDocument();
});
it("keeps brand text after network failure and focuses the error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(
    <SettingsPanel
      workspace="team"
      initial={{ ...initial, role: "owner", isDemo: false }}
      storageAvailable={false}
    />,
  );
  const name = screen.getByLabelText("Workspace name");
  await userEvent.clear(name);
  await userEvent.type(name, "New name");
  await userEvent.click(screen.getByRole("button", { name: "Save branding" }));
  expect(name).toHaveValue("New name");
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(
    screen.getByText(/Logo uploads are not configured/),
  ).toBeInTheDocument();
});
it("keeps the member search when opening the next page", () => {
  render(
    <SettingsPanel
      workspace="team"
      initial={{
        ...initial,
        role: "owner",
        isDemo: false,
        members: { items: [], nextCursor: "next" },
      }}
      storageAvailable={false}
      memberSearch="Alex"
    />,
  );
  expect(screen.getByRole("link", { name: "More members" })).toHaveAttribute(
    "href",
    "?search=Alex&cursor=next",
  );
  expect(screen.getByLabelText("Find a member")).toHaveValue("Alex");
});
