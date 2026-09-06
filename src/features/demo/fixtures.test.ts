import { describe, expect, it } from "vitest";
import { CANONICAL_SHOWCASE, buildWorkspaceFixtures } from "./fixtures";

const input = {
  workspaceId: CANONICAL_SHOWCASE.id,
  memberId: "51000000-0000-4000-8000-000000000002",
  moderatorId: "51000000-0000-4000-8000-000000000003",
  canonical: true,
};

describe("original showcase fixtures", () => {
  it("creates the complete journey within demo quotas", () => {
    const data = buildWorkspaceFixtures(input);
    expect(data.boards.map((board) => board.slug)).toEqual([
      "ideas",
      "workflow",
      "integrations",
    ]);
    expect(data.tags).toHaveLength(6);
    expect(
      data.feedback.filter((item) => item.visibility === "published"),
    ).toHaveLength(18);
    expect(
      data.feedback.filter((item) => item.visibility === "pending"),
    ).toHaveLength(3);
    expect(new Set(data.feedback.map((item) => item.status))).toEqual(
      new Set([
        "under_review",
        "planned",
        "in_progress",
        "completed",
        "closed",
      ]),
    );
    expect(data.comments).toHaveLength(24);
    expect(data.changelogEntries).toHaveLength(3);
    expect(data.changelogEntries.every((entry) => entry.publishedAt)).toBe(
      true,
    );
    expect([
      30 - data.feedback.length,
      100 - data.comments.length,
      10 - data.changelogEntries.length,
    ]).toEqual([9, 76, 7]);
  });

  it("provides merge candidates, a shipped suggestion and actual discussion", () => {
    const data = buildWorkspaceFixtures(input);
    const candidates = data.feedback.filter((item) =>
      ["weekly-progress-digest", "weekly-email-recap"].includes(item.slug),
    );
    expect(candidates).toHaveLength(2);
    expect(
      candidates.every(
        (item) =>
          item.visibility === "published" && item.status === "under_review",
      ),
    ).toBe(true);
    expect(candidates[0].boardId).toBe(candidates[1].boardId);
    expect(data.changelogFeedback.length).toBeGreaterThan(0);
    for (const link of data.changelogFeedback) {
      expect(
        data.feedback.find((item) => item.id === link.feedbackId)?.status,
      ).toBe("completed");
      expect(
        data.changelogEntries.some(
          (entry) => entry.id === link.changelogEntryId && entry.publishedAt,
        ),
      ).toBe(true);
    }
    const replies = data.comments.filter((comment) => comment.parentId);
    expect(replies.length).toBeGreaterThan(0);
    for (const reply of replies)
      expect(
        data.comments.find((comment) => comment.id === reply.parentId)
          ?.feedbackId,
      ).toBe(reply.feedbackId);
    expect(
      new Set(data.votes.map((vote) => `${vote.feedbackId}:${vote.memberId}`))
        .size,
    ).toBe(data.votes.length);
  });

  it("is deterministic only for the canonical showcase and keeps every relation inside its workspace", () => {
    const first = buildWorkspaceFixtures(input);
    expect(buildWorkspaceFixtures(input)).toEqual(first);
    const demo = {
      ...input,
      workspaceId: "62000000-0000-4000-8000-000000000001",
      canonical: false,
    };
    const a = buildWorkspaceFixtures(demo);
    const b = buildWorkspaceFixtures(demo);
    expect(a.feedback.map((item) => item.slug)).toEqual(
      first.feedback.map((item) => item.slug),
    );
    expect(a.feedback.map((item) => item.id)).not.toEqual(
      b.feedback.map((item) => item.id),
    );
    expect(a.boards.map((item) => item.id)).not.toEqual(
      first.boards.map((item) => item.id),
    );
    for (const rows of Object.values(a))
      for (const row of rows) expect(row.workspaceId).toBe(demo.workspaceId);
    expect(
      a.members.every(
        (member) =>
          member.userId == null &&
          member.demoSessionId == null &&
          member.role === "member",
      ),
    ).toBe(true);
    expect(() => buildWorkspaceFixtures({ ...demo, canonical: true })).toThrow(
      "canonical",
    );
  });
});
