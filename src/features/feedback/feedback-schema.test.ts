import { describe, expect, it } from "vitest";
import {
  createFeedbackSchema,
  feedbackFiltersSchema,
  decodeCursor,
  encodeCursor,
  escapeLike,
  feedbackSlug,
} from "./feedback-schema";

const boardId = "11111111-1111-4111-8111-111111111111";
describe("feedback validation", () => {
  it("trims content and defaults tags", () => {
    expect(
      createFeedbackSchema.parse({
        title: "  Dark mode  ",
        description: "  Please support dark mode.  ",
        boardId,
      }),
    ).toEqual({
      title: "Dark mode",
      description: "Please support dark mode.",
      boardId,
      tagIds: [],
    });
  });
  it.each([
    { title: " tiny " },
    { title: "x".repeat(141) },
    { description: "  short  " },
    { description: "x".repeat(10001) },
    { boardId: "not-a-uuid" },
    { tagIds: [boardId, boardId] },
    {
      tagIds: Array.from(
        { length: 6 },
        (_, i) => `11111111-1111-4111-8111-11111111111${i}`,
      ),
    },
    { role: "owner" },
    { visibility: "published" },
  ])("rejects malformed or privileged input %j", (change) => {
    expect(
      createFeedbackSchema.safeParse({
        title: "Dark mode",
        description: "Please add dark mode",
        boardId,
        ...change,
      }).success,
    ).toBe(false);
  });
  it("validates bounded filters and opaque keyset cursors", () => {
    const cursor = {
      createdAt: new Date("2026-09-06T00:00:00.123Z"),
      id: boardId,
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual({
      ...cursor,
      createdAt: cursor.createdAt.toISOString(),
    });
    expect(feedbackFiltersSchema.safeParse({ cursor: "garbage" }).success).toBe(
      false,
    );
    expect(feedbackFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(feedbackFiltersSchema.safeParse({ status: "secret" }).success).toBe(
      false,
    );
    expect(feedbackFiltersSchema.parse({})).toEqual({
      limit: 20,
      visibility: "published",
    });
    const precise = { createdAt: "2026-09-06T00:00:00.123456Z", id: boardId };
    expect(decodeCursor(encodeCursor(precise))).toEqual(precise);
    expect(
      decodeCursor(encodeCursor({ ...precise, id: "invalid" })),
    ).toBeNull();
  });
  it("escapes literal SQL wildcards and creates URL safe unique slugs", () => {
    expect(escapeLike("50%_\\")).toBe("50\\%\\_\\\\");
    expect(feedbackSlug(" <script>你好 / World? ", boardId)).toMatch(
      /^[a-z0-9-]+$/,
    );
    expect(feedbackSlug("你好", boardId)).toBe(`feedback-${boardId}`);
  });
  it.each([
    "2026-02-30T12:00:00.123456Z",
    "2026-02-29T12:00:00.123456Z",
    "1900-02-29T12:00:00.123456Z",
    "2026-04-31T12:00:00.123456Z",
    "2026-09-06T24:00:00.123456Z",
    "2026-09-06T12:60:00.123456Z",
    "0000-01-01T00:00:00.123456Z",
  ])("rejects impossible cursor timestamp %s before querying", (createdAt) => {
    const cursor = encodeCursor({ createdAt, id: boardId });
    expect(decodeCursor(cursor)).toBeNull();
    expect(feedbackFiltersSchema.safeParse({ cursor }).success).toBe(false);
  });
  it.each(["2024-02-29T23:59:59.123456Z", "2000-02-29T00:00:00.000001Z"])(
    "preserves valid leap-day microseconds %s",
    (createdAt) => {
      const value = { createdAt, id: boardId };
      expect(decodeCursor(encodeCursor(value))).toEqual(value);
    },
  );
});
