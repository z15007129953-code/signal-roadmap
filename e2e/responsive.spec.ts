import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { acceptanceViewports, expectReachable } from "./fixtures";

for (const { width, height } of acceptanceViewports) {
  test(`public journey remains reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of [
      "/",
      "/signal-roadmap/feedback",
      "/signal-roadmap/feedback/weekly-progress-digest",
      "/signal-roadmap/roadmap",
      "/signal-roadmap/changelog",
      "/signal-roadmap/changelog/follow-the-progress",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        audit.violations.filter((issue) =>
          ["serious", "critical"].includes(issue.impact ?? ""),
        ),
      ).toEqual([]);
      if (path === "/signal-roadmap/feedback") {
        await expect(
          page.getByRole("link", { name: "Share feedback", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByLabel("Search feedback", { exact: true }),
        ).toBeVisible();
        await expect(page.getByLabel("Board", { exact: true })).toBeVisible();
        await expectReachable(
          page.getByRole("button", { name: "Apply filters", exact: true }),
        );
        await expectReachable(
          page.getByRole("link", { name: "Share feedback", exact: true }),
        );
      } else if (path === "/signal-roadmap/roadmap") {
        await expectReachable(
          page.getByRole("link", {
            name: "A weekly digest of the ideas I follow",
            exact: true,
          }),
        );
      } else if (path === "/signal-roadmap/changelog") {
        await expectReachable(
          page.getByRole("link", {
            name: "Follow the progress that matters to you",
            exact: true,
          }),
        );
      } else if (path === "/") {
        await expectReachable(
          page.getByRole("button", {
            name: "Start a private demo",
            exact: true,
          }),
        );
      }
    }
  });
}
