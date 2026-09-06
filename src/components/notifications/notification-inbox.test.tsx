import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const initial = {
  unreadCount: 1,
  nextCursor: null,
  items: [
    {
      id: "n",
      feedbackId: "f",
      feedbackSlug: "better-search",
      type: "comment_added" as const,
      title: "Better search",
      body: "A new comment was added.",
      createdAt: new Date(),
      readAt: null,
    },
  ],
};
it("marks a notification as read only after server confirmation", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ok: true, value: { id: "n", readAt: new Date() } }),
      ),
  );
  render(<NotificationInbox workspace="demo" initial={initial} />);
  expect(screen.getByRole("link", { name: "Better search" })).toHaveAttribute(
    "href",
    "/demo/feedback/better-search",
  );
  await userEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  expect(
    screen.queryByRole("button", { name: "Mark as read" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("0 unread");
});
it("keeps unread state when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<NotificationInbox workspace="demo" initial={initial} />);
  await userEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  expect(screen.getByRole("status")).toHaveTextContent("1 unread");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
it("links published release notifications to the changelog", () => {
  render(
    <NotificationInbox
      workspace="demo"
      initial={{
        ...initial,
        items: [
          {
            ...initial.items[0],
            feedbackId: null,
            feedbackSlug: null,
            changelogSlug: "first-release",
            type: "changelog_published",
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("link", { name: "Better search" })).toHaveAttribute(
    "href",
    "/demo/changelog/first-release",
  );
});
