import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FeedbackAccessNotice } from "./workspace-shell";
afterEach(cleanup);
it.each([
  ["DEMO_EXPIRED", "This demo has expired."],
  ["FORBIDDEN", "You do not have access to this page."],
  ["DEMO_QUOTA_EXCEEDED", "This demo has reached its usage limit."],
] as const)("renders an actionable %s notice", (code, title) => {
  render(<FeedbackAccessNotice code={code} />);
  expect(screen.getByRole("heading", { name: title })).toHaveFocus();
  expect(screen.getByRole("link", { name: "Back to home" })).toBeVisible();
});
