import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FeedbackForm } from "./feedback-form";
import { FeedbackList, FeedbackDetail } from "./feedback-views";
import type { FeedbackItem } from "@/features/feedback/types";

const boardId = "00000000-0000-4000-8000-000000000001";
const taxonomy = { boards: [{ id: boardId, name: "Ideas" }], tags: [] };
const item: FeedbackItem = {
  id: boardId,
  boardId,
  authorId: boardId,
  slug: "export-reports",
  title: "Export reports",
  body: "An offline report would help our team.",
  createdAt: new Date("2026-09-01T12:00:00Z"),
  status: "under_review",
  visibility: "published",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("links a focused validation summary to labelled fields", async () => {
  render(<FeedbackForm workspace="community" taxonomy={taxonomy} />);
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(screen.getByRole("link", { name: /Title needs/ })).toHaveAttribute(
    "href",
    "#title",
  );
  expect(screen.getByLabelText("Title")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Description")).toHaveAttribute(
    "aria-describedby",
    expect.stringContaining("description-error"),
  );
});

it("supports keyboard submission and explains pending review", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, value: { ...item, visibility: "pending" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  render(<FeedbackForm workspace="community" taxonomy={taxonomy} />);
  await userEvent.type(screen.getByLabelText("Title"), "Export reports");
  await userEvent.type(screen.getByLabelText("Description"), item.body);
  screen.getByRole("button", { name: "Send feedback" }).focus();
  await userEvent.keyboard("{Enter}");
  expect(
    await screen.findByText("Your feedback is awaiting review."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "View your feedback" }),
  ).toHaveAttribute("href", "/community/feedback/export-reports");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    title: item.title,
    description: item.body,
    boardId,
    tagIds: [],
  });
});

it("keeps the draft after quota failure and offers recovery", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "DEMO_QUOTA_EXCEEDED" } },
          { status: 429 },
        ),
      ),
  );
  render(<FeedbackForm workspace="community" taxonomy={taxonomy} />);
  await userEvent.type(screen.getByLabelText("Title"), item.title);
  await userEvent.type(screen.getByLabelText("Description"), item.body);
  await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("usage limit");
  expect(screen.getByLabelText("Description")).toHaveValue(item.body);
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
});

it("lets suggestions fail without blocking submission", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<FeedbackForm workspace="community" taxonomy={taxonomy} />);
  await userEvent.type(screen.getByLabelText("Title"), item.title);
  await userEvent.click(
    screen.getByRole("button", { name: "Find similar feedback" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("You can still send"),
  );
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
});

it("preserves URL filters on pagination and exposes phone actions", () => {
  render(
    <FeedbackList
      workspace="community"
      taxonomy={taxonomy}
      filters={{ query: "export", boardId, status: "planned" }}
      page={{ items: [item], nextCursor: "next" }}
    />,
  );
  expect(screen.getByLabelText("Search feedback")).toHaveValue("export");
  expect(screen.getByLabelText("Status")).toHaveValue("planned");
  expect(screen.getByRole("link", { name: "Share feedback" })).toHaveAttribute(
    "href",
    "/community/feedback/new",
  );
  const next = new URL(
    screen.getByRole("link", { name: "Older feedback" }).getAttribute("href")!,
    "https://example.test",
  );
  expect(next.searchParams.get("q")).toBe("export");
  expect(next.searchParams.get("boardId")).toBe(boardId);
  expect(next.searchParams.get("status")).toBe("planned");
  expect(next.searchParams.get("cursor")).toBe("next");
});

it("renders a long title fully and suppresses raw HTML and tracking images", () => {
  const title = "A".repeat(200);
  const { container } = render(
    <FeedbackDetail
      item={{
        ...item,
        title,
        body: "Useful **details**\n\n<script>alert(1)</script>\n\n![tracking](https://tracker.example/pixel)\n\n[Unsafe](javascript:alert(1))",
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: title })).toHaveClass(
    "[overflow-wrap:anywhere]",
  );
  expect(container.querySelector("script, img")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(screen.getByText("details").tagName).toBe("STRONG");
});

it("discards suggestions for a title that changed during the request", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  render(<FeedbackForm workspace="community" taxonomy={taxonomy} />);
  await userEvent.type(screen.getByLabelText("Title"), "Export reports");
  await userEvent.click(
    screen.getByRole("button", { name: "Find similar feedback" }),
  );
  await userEvent.clear(screen.getByLabelText("Title"));
  await userEvent.type(screen.getByLabelText("Title"), "Improve navigation");
  await act(async () => {
    finish(Response.json({ ok: true, value: [item] }));
  });
  expect(
    screen.queryByRole("link", { name: /Export reports/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
});

it("explains an empty board without inventing votes or activity", () => {
  render(
    <FeedbackList
      workspace="community"
      taxonomy={taxonomy}
      filters={{}}
      page={{ items: [], nextCursor: null }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "A good idea starts a conversation." }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Older feedback" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/votes/i)).not.toBeInTheDocument();
});
