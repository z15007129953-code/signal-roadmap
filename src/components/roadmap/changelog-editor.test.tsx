import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ChangelogEditor } from "./changelog-editor";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  refresh.mockClear();
  vi.unstubAllGlobals();
});
it("keeps existing linked ideas visible outside the initial search page", () => {
  const linked = {
    id: "older",
    slug: "older-idea",
    title: "Older completed idea",
  };
  render(
    <ChangelogEditor
      workspace="demo"
      completed={[]}
      initial={{ ...draft, feedback: [linked] }}
    />,
  );
  expect(screen.getByRole("checkbox", { name: linked.title })).toBeChecked();
});
it("saves without an optional summary and refreshes the saved draft list", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, value: { ...draft, summary: "" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(
    <ChangelogEditor
      workspace="demo"
      completed={[]}
      initial={{ ...draft, summary: "" }}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(fetcher).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledOnce();
});
const draft = {
  id: "entry",
  slug: "release",
  title: "Our first release",
  summary: "Useful changes",
  body: "A useful improvement is ready.",
  feedback: [],
  authorId: "a",
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
it("retains a release draft when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<ChangelogEditor workspace="demo" completed={[]} />);
  await userEvent.type(
    screen.getByLabelText("Title", { exact: true }),
    "Our first release",
  );
  await userEvent.type(
    screen.getByLabelText("Summary", { exact: true }),
    "Useful changes",
  );
  await userEvent.type(
    screen.getByLabelText("Release notes", { exact: true }),
    "A useful improvement is ready.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByRole("alert")).toHaveTextContent("connection");
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(screen.getByLabelText("Release notes", { exact: true })).toHaveValue(
    "A useful improvement is ready.",
  );
});
it("requires explicit publication after saving a draft", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, value: { ...draft, publishedAt: new Date() } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(<ChangelogEditor workspace="demo" completed={[]} initial={draft} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Publish release" }),
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    screen.getByRole("group", { name: "Confirm publication" }),
  ).toHaveTextContent("Our first release");
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm publication" }),
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/api/workspaces/demo/changelog/entry/publish",
    expect.objectContaining({ method: "POST" }),
  );
  expect(
    screen.getByRole("link", { name: "Read published release" }),
  ).toHaveAttribute("href", "/demo/changelog/release");
});
it("explains how to reconcile unavailable linked ideas after publication validation fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "VALIDATION_FAILED" } },
          { status: 422 },
        ),
      ),
  );
  render(<ChangelogEditor workspace="demo" completed={[]} initial={draft} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Publish release" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm publication" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Save draft to remove unavailable links",
  );
});
