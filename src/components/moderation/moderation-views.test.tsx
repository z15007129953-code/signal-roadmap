import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ModerationQueue } from "./moderation-queue";
import { MergedHistory } from "./merged-history";
afterEach(cleanup);
it("keeps review actions and pagination reachable with long titles", () => {
  render(
    <ModerationQueue
      workspace="demo"
      page={{
        items: [
          {
            id: "f",
            title: "Long title ".repeat(20),
            slug: "idea",
            body: "Details",
            authorId: "a",
            boardId: "b",
            status: "under_review",
            visibility: "pending",
            createdAt: new Date(),
          },
        ],
        nextCursor: "next",
      }}
    />,
  );
  expect(screen.getByRole("link", { name: /Review idea/ })).toHaveAttribute(
    "href",
    "/demo/feedback/idea",
  );
  expect(
    screen.getByRole("link", { name: "More submissions" }),
  ).toHaveAttribute("href", "/demo/admin/moderation?cursor=next");
});
it("shows source attribution without exposing removed text or edit controls", () => {
  const now = new Date();
  render(
    <MergedHistory
      detailPath="/demo/feedback/kept"
      page={{
        nextCursor: "next",
        items: [
          {
            sourceId: "s",
            sourceSlug: "source",
            sourceTitle: "Original idea",
            comment: {
              id: "c",
              body: "Must not appear",
              authorId: "a",
              authorName: "Original author",
              parentId: null,
              createdAt: now,
              updatedAt: now,
              deletedAt: now,
              canEdit: false,
              canDelete: false,
            },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/Original idea/)).toBeInTheDocument();
  expect(screen.getByText("Original author")).toBeInTheDocument();
  expect(screen.queryByText("Must not appear")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "More earlier comments" }),
  ).toHaveAttribute(
    "href",
    "/demo/feedback/kept?historyCursor=next#merged-history",
  );
});
