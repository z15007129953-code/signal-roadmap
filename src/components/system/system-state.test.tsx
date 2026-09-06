import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SystemState } from "./system-state";
afterEach(cleanup);
it("focuses the error summary and offers a working retry without exposing exceptions", async () => {
  const retry = vi.fn();
  render(<SystemState kind="unexpected" reference="123456" retry={retry} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  expect(screen.getByText("Reference: 123456")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
});
it.each(["expired", "forbidden", "not-found", "offline", "quota"] as const)(
  "provides an actionable %s state",
  (kind) => {
    render(<SystemState kind={kind} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
  },
);
