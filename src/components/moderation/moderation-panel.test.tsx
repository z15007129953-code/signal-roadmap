import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ModerationPanel } from "./moderation-panel";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const item = {
  id: "idea",
  slug: "better-search",
  title: "Better search",
  body: "Useful search capabilities.",
  status: "under_review" as const,
  visibility: "pending" as const,
  authorId: "a",
  boardId: "b",
  createdAt: new Date(),
};
const taxonomy = { boards: [{ id: "b", name: "Ideas" }], tags: [] };
it("approves a pending item and refreshes only after the saved response", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, value: { ...item, visibility: "published" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(
    <ModerationPanel
      workspace="demo"
      item={item}
      taxonomy={taxonomy}
      tagIds={[]}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Approve and publish" }),
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/api/workspaces/demo/feedback/idea/moderation",
    expect.objectContaining({ body: '{"action":"approve"}' }),
  );
  expect(refresh).toHaveBeenCalledOnce();
});
it("requires an explicit named merge confirmation before sending", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        ok: true,
        value: [
          {
            ...item,
            id: "target",
            slug: "saved-filters",
            title: "Saved filters",
            visibility: "published",
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ ok: true, value: { ...item, visibility: "merged" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(
    <ModerationPanel
      workspace="demo"
      item={{ ...item, visibility: "published" }}
      taxonomy={taxonomy}
      tagIds={[]}
    />,
  );
  await userEvent.click(screen.getByText("Merge a duplicate", { exact: true }));
  await userEvent.type(
    screen.getByLabelText("Find the idea to keep"),
    "Saved filters",
  );
  await userEvent.click(screen.getByRole("button", { name: "Find matches" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Keep Saved filters" }),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("group", { name: "Confirm merge" }),
  ).toHaveTextContent("Better search");
  expect(
    screen.getByRole("group", { name: "Confirm merge" }),
  ).toHaveTextContent("Saved filters");
  await userEvent.click(
    screen.getByRole("button", { name: "Merge into Saved filters" }),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("preserves the current state and explains conflicts", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "CONFLICT" } },
          { status: 409 },
        ),
      ),
  );
  render(
    <ModerationPanel
      workspace="demo"
      item={item}
      taxonomy={taxonomy}
      tagIds={[]}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Approve and publish" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("changed");
  expect(refresh).not.toHaveBeenCalled();
});
it("does not offer merging until a pending submission has been published", () => {
  render(
    <ModerationPanel
      workspace="demo"
      item={item}
      taxonomy={taxonomy}
      tagIds={[]}
    />,
  );
  expect(
    screen.queryByText("Merge a duplicate", { exact: true }),
  ).not.toBeInTheDocument();
});
