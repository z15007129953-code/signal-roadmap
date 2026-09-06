import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FeedbackPage from "@/app/[workspace]/feedback/page";
import NewFeedbackPage from "@/app/[workspace]/feedback/new/page";
import DetailPage from "@/app/[workspace]/feedback/[slug]/page";
import { ok, err } from "@/lib/http/result";
import { domainError } from "@/lib/http/errors";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { moderationService } from "@/lib/moderation-runtime";
import type { FeedbackContext } from "@/lib/feedback-context";

vi.mock("@/lib/feedback-runtime", () => ({ loadFeedbackContext: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "page-test-1234" }),
}));
vi.mock("@/lib/engagement-runtime", () => ({ engagementServices: vi.fn() }));
vi.mock("@/lib/moderation-runtime", () => ({ moderationService: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && /^(NOT_FOUND|REDIRECT:)/.test(error.message))
      throw error;
  },
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const boardId = "00000000-0000-4000-8000-000000000001";
const actor = {
  kind: "demo" as const,
  userId: null,
  memberId: boardId,
  workspaceId: boardId,
  role: "member" as const,
};
const taxonomy = { boards: [{ id: boardId, name: "Ideas" }], tags: [] };
const service = {
  list: vi.fn(),
  taxonomy: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  suggest: vi.fn(),
};
const context: FeedbackContext = {
  workspace: {
    id: boardId,
    slug: "demo",
    name: "Your demo",
    description: null,
    isDemo: true,
  },
  actor,
  service,
};
beforeEach(() => {
  vi.mocked(moderationService).mockReturnValue({
    redirect: vi.fn().mockResolvedValue(ok(null)),
    history: vi.fn().mockResolvedValue(ok({ items: [], nextCursor: null })),
  } as unknown as ReturnType<typeof moderationService>);
  vi.mocked(loadFeedbackContext).mockResolvedValue(ok(context));
  service.list.mockResolvedValue(ok({ items: [], nextCursor: null }));
  service.taxonomy.mockResolvedValue(ok(taxonomy));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("maps browser query filters to the scoped service", async () => {
  render(
    await FeedbackPage({
      params: Promise.resolve({ workspace: "demo" }),
      searchParams: Promise.resolve({
        q: "export",
        boardId: "",
        status: "planned",
      }),
    }),
  );
  expect(service.list).toHaveBeenCalledWith(actor, boardId, {
    query: "export",
    status: "planned",
    visibility: "published",
    limit: 20,
  });
  expect(screen.getByLabelText("Search feedback")).toHaveValue("export");
  expect(
    screen.getByText("No feedback matches these filters."),
  ).toBeInTheDocument();
});
it("rejects malformed cursors without calling the list query", async () => {
  render(
    await FeedbackPage({
      params: Promise.resolve({ workspace: "demo" }),
      searchParams: Promise.resolve({ cursor: "invalid" }),
    }),
  );
  expect(service.list).not.toHaveBeenCalled();
  expect(screen.getByRole("heading")).toHaveTextContent(
    "filters could not be applied",
  );
});
it("keeps private workspace metadata out of expired-session pages", async () => {
  vi.mocked(loadFeedbackContext).mockResolvedValue(
    err(domainError("DEMO_EXPIRED")),
  );
  render(
    await NewFeedbackPage({
      params: Promise.resolve({ workspace: "demo" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.queryByText("Your demo")).not.toBeInTheDocument();
  expect(screen.getByRole("heading")).toHaveTextContent("expired");
  expect(service.taxonomy).not.toHaveBeenCalled();
});
it("shows the member review policy before submission", async () => {
  render(
    await NewFeedbackPage({
      params: Promise.resolve({ workspace: "demo" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByText(/will be reviewed before/)).toBeInTheDocument();
  expect(screen.getByLabelText("Board")).toHaveValue(boardId);
});
it("renders authorized pending detail through the workspace service", async () => {
  service.detail.mockResolvedValue(
    ok({
      id: boardId,
      boardId,
      authorId: boardId,
      slug: "a-new-idea",
      title: "A new idea",
      body: "A useful description.",
      status: "under_review",
      visibility: "pending",
      createdAt: new Date("2026-09-06T00:00:00Z"),
    }),
  );
  render(
    await DetailPage({
      params: Promise.resolve({ workspace: "demo", slug: "a-new-idea" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(service.detail).toHaveBeenCalledWith(actor, boardId, "a-new-idea");
  expect(
    screen.getByRole("heading", { name: "Awaiting review" }),
  ).toBeInTheDocument();
});
it("resolves a scoped merge redirect before loading the removed detail", async () => {
  vi.mocked(moderationService).mockReturnValue({
    redirect: vi.fn().mockResolvedValue(ok({ slug: "kept-idea" })),
  } as unknown as ReturnType<typeof moderationService>);
  await expect(
    DetailPage({
      params: Promise.resolve({ workspace: "demo", slug: "old-idea" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("REDIRECT:/demo/feedback/kept-idea");
  expect(service.detail).not.toHaveBeenCalled();
});
