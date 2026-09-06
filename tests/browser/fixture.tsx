// Browser-only acceptance fixture. Never mounted in the production application.
import { createRoot } from "react-dom/client";
import { FeedbackForm } from "../../src/components/feedback/feedback-form";
import {
  FeedbackList,
  FeedbackDetail,
} from "../../src/components/feedback/feedback-views";
import type { FeedbackItem } from "../../src/features/feedback/types";
import "../../src/app/globals.css";

const boardId = "00000000-0000-4000-8000-000000000001";
const taxonomy = {
  boards: [{ id: boardId, name: "Product ideas" }],
  tags: [{ id: "00000000-0000-4000-8000-000000000002", name: "Accessibility" }],
};
const item: FeedbackItem = {
  id: boardId,
  boardId,
  authorId: boardId,
  slug: "export-reports",
  title: "Export reports for the whole team",
  body: "We share a weekly update with colleagues who cannot access the dashboard.\n\n## What would help\n\n- A downloadable summary\n- Clear dates and readable headings\n\n**Why it matters:** everyone should have the same context.",
  status: "under_review",
  visibility: "published",
  createdAt: new Date("2026-09-06T10:00:00Z"),
};
const mode = new URLSearchParams(location.search).get("mode");
const longItem = {
  ...item,
  id: "long",
  slug: "long-title",
  title: "A".repeat(200),
  status: "planned" as const,
};
createRoot(document.getElementById("root")!).render(
  <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
    <header className="border-b border-rule py-5">
      <p className="text-lg font-semibold">Signal Roadmap /</p>
      <p className="text-sm text-muted">
        Acceptance fixture — synthetic data, no database connection
      </p>
    </header>
    <main className="py-8 sm:py-12">
      {mode === "form" ? (
        <>
          <h1 className="mb-8 font-serif text-3xl">
            What would make this better?
          </h1>
          <FeedbackForm workspace="fixture" taxonomy={taxonomy} />
        </>
      ) : mode === "detail" ? (
        <FeedbackDetail
          item={{ ...longItem, body: item.body, visibility: "pending" }}
        />
      ) : (
        <FeedbackList
          workspace="fixture"
          taxonomy={taxonomy}
          filters={{}}
          page={{
            items:
              mode === "empty"
                ? []
                : [
                    item,
                    longItem,
                    {
                      ...item,
                      id: "completed",
                      slug: "keyboard-shortcuts",
                      title: "Keyboard shortcuts for everyday actions",
                      status: "completed",
                    },
                  ],
            nextCursor: null,
          }}
        />
      )}
    </main>
  </div>,
);
