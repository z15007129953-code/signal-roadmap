import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RoadmapBoard } from "./roadmap-board";
afterEach(cleanup);
it("labels all five statuses and makes each column pagination reachable", () => {
  const item = {
    id: "f",
    slug: "search",
    title: "Better search",
    body: "Useful context",
    status: "planned" as const,
    visibility: "published" as const,
    authorId: "a",
    boardId: "b",
    createdAt: new Date(),
  };
  render(
    <RoadmapBoard
      workspace="demo"
      columns={{
        under_review: { items: [], nextCursor: null },
        planned: { items: [item], nextCursor: "next" },
        in_progress: { items: [], nextCursor: null },
        completed: { items: [], nextCursor: null },
        closed: { items: [], nextCursor: null },
      }}
    />,
  );
  for (const name of [
    "Under review",
    "Planned",
    "In progress",
    "Completed",
    "Closed",
  ])
    expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Better search" })).toHaveAttribute(
    "href",
    "/demo/feedback/search",
  );
  expect(
    screen.getByRole("link", { name: "More planned ideas" }),
  ).toHaveAttribute("href", "/demo/roadmap?status=planned&cursor=next#planned");
});
