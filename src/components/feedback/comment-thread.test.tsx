import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CommentThread } from "./comment-thread";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const date = new Date("2026-09-06T00:00:00Z");
const item = {
  id: "one",
  body: "An existing comment",
  authorId: "author",
  authorName: "Sam",
  parentId: null,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  canEdit: true,
  canDelete: true,
};
it("preserves a typed comment after a recoverable save failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(
    <CommentThread
      workspace="demo"
      feedbackId="idea"
      initial={{ items: [], nextCursor: null }}
      canComment
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Your comment"),
    "Keep this useful context",
  );
  await userEvent.click(screen.getByRole("button", { name: "Post comment" }));
  expect(screen.getByLabelText("Your comment")).toHaveValue(
    "Keep this useful context",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("connection");
});
it("posts replies with their parent and shows the saved comment", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      ok: true,
      value: { ...item, id: "two", body: "A useful reply", parentId: "one" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <CommentThread
      workspace="demo"
      feedbackId="idea"
      initial={{ items: [item], nextCursor: null }}
      canComment
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Reply" }));
  await userEvent.type(screen.getByLabelText("Your comment"), "A useful reply");
  await userEvent.click(screen.getByRole("button", { name: "Post reply" }));
  expect(fetcher).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: '{"body":"A useful reply","parentId":"one"}',
    }),
  );
  expect(await screen.findByText("A useful reply")).toBeInTheDocument();
  expect(screen.getByLabelText("Your comment")).toHaveValue("");
});
it("requires confirmation before deleting and preserves reply context", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      ok: true,
      value: {
        ...item,
        body: "",
        deletedAt: date,
        canEdit: false,
        canDelete: false,
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <CommentThread
      workspace="demo"
      feedbackId="idea"
      initial={{ items: [item], nextCursor: null }}
      canComment
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm deletion" }),
  );
  expect(await screen.findByText("Comment removed.")).toBeInTheDocument();
  expect(screen.queryByText("An existing comment")).not.toBeInTheDocument();
});
it("only exposes edit/delete controls when the server grants permission", () => {
  render(
    <CommentThread
      workspace="demo"
      feedbackId="idea"
      initial={{
        items: [{ ...item, canEdit: false, canDelete: false }],
        nextCursor: null,
      }}
      canComment={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
});
it("keeps newly posted comments after older pages when loading more", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          value: {
            ...item,
            id: "three",
            body: "Newest comment",
            createdAt: new Date("2026-09-06T03:00:00Z"),
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          value: {
            items: [
              {
                ...item,
                id: "two",
                body: "Middle comment",
                createdAt: new Date("2026-09-06T02:00:00Z"),
              },
            ],
            nextCursor: null,
          },
        }),
      ),
  );
  render(
    <CommentThread
      workspace="demo"
      feedbackId="idea"
      initial={{ items: [item], nextCursor: "next" }}
      canComment
    />,
  );
  await userEvent.type(screen.getByLabelText("Your comment"), "Newest comment");
  await userEvent.click(screen.getByRole("button", { name: "Post comment" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Load more comments" }),
  );
  expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(
    [
      expect.stringContaining("An existing comment"),
      expect.stringContaining("Middle comment"),
      expect.stringContaining("Newest comment"),
    ],
  );
});
