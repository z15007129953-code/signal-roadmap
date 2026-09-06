import AxeBuilder from "@axe-core/playwright";
import type { Locator, Request } from "@playwright/test";
import {
  acceptanceViewports,
  demoIdeas,
  test,
  expect,
  expectReachable,
  expectSaved,
  settlePage,
} from "./fixtures";

test("member and moderator actions are reachable and keyboard accessible at every required viewport", async ({
  page,
  demo,
}) => {
  test.setTimeout(240000);
  const root = demo.boardUrl.replace(/\/feedback$/, "");
  for (const viewport of acceptanceViewports) {
    await test.step(`member actions at ${viewport.width}×${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await visit(demo.boardUrl);
      await reachable(
        page.getByLabel("Search feedback", { exact: true }),
        page.getByLabel("Board", { exact: true }),
        page.getByLabel("Status", { exact: true }),
        page.getByRole("button", { name: "Apply filters", exact: true }),
        page.getByRole("link", { name: "Share feedback", exact: true }),
      );
      await scan();
      await page
        .getByRole("link", { name: "Share feedback", exact: true })
        .click();
      await settlePage(page);
      await reachable(
        page.getByLabel("Title", { exact: true }),
        page.getByLabel("Description", { exact: true }),
        page.getByLabel("Board", { exact: true }),
        page.getByRole("button", { name: "Send feedback", exact: true }),
      );
      await scan();
      await visit(demo.targetUrl);
      await page
        .getByLabel("Your comment", { exact: true })
        .fill(
          "A draft to verify the comment action is reachable at this screen size.",
        );
      await reachable(
        page.getByRole("button", { name: /^Vote ·/ }),
        page.getByRole("button", { name: "Following updates", exact: true }),
        page.getByLabel("Your comment", { exact: true }),
        page.getByRole("button", { name: "Post comment", exact: true }),
      );
      await scan();
      await page.getByRole("link", { name: "Roadmap", exact: true }).click();
      await settlePage(page);
      await reachable(
        page.getByRole("link", { name: demoIdeas.target.title, exact: true }),
      );
      await scan();
      await page.getByRole("link", { name: "Changelog", exact: true }).click();
      await settlePage(page);
      await reachable(
        page.getByRole("link", {
          name: "Follow the progress that matters to you",
          exact: true,
        }),
      );
      await scan();
    });
  }
  await expectSaved(page, "POST", "/api/demo/persona", () =>
    page
      .getByRole("button", { name: "Try moderator view", exact: true })
      .click(),
  );
  await expect(
    page.getByText("Viewing as moderator", { exact: true }),
  ).toBeVisible();
  for (const viewport of acceptanceViewports) {
    await test.step(`moderation, publishing and keyboard controls at ${viewport.width}×${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await visit(`${root}/admin/moderation`);
      const review = page.getByRole("link", { name: /^Review idea/ }).first();
      await reachable(review);
      await scan();
      await review.click();
      await settlePage(page);
      await reachable(
        page.getByRole("button", { name: "Approve and publish", exact: true }),
        page.getByRole("button", {
          name: "Close without publishing",
          exact: true,
        }),
      );
      await scan();
      await visit(demo.targetUrl);
      await reachable(page.getByLabel("Roadmap status", { exact: true }));
      await page
        .getByLabel("Roadmap status", { exact: true })
        .selectOption("planned");
      await reachable(
        page.getByRole("button", { name: "Save status", exact: true }),
      );
      await page.getByText("Merge a duplicate", { exact: true }).click();
      await reachable(
        page.getByLabel("Find the idea to keep", { exact: true }),
        page.getByRole("button", { name: "Find matches", exact: true }),
      );
      await scan();
      await visit(`${root}/admin/changelog`);
      await reachable(
        page.getByLabel("Title", { exact: true }),
        page.getByLabel("Summary", { exact: true }),
        page.getByLabel("Release notes", { exact: true }),
        page.getByRole("button", { name: "Save draft", exact: true }),
      );
      await scan();
      await visit(`${root}/admin/settings`);
      await keyboardDetailsAndConfirmation();
      await scan();
    });
  }

  async function visit(url: string) {
    await page.goto(url);
    await settlePage(page);
  }

  async function reachable(...controls: Locator[]) {
    for (const control of controls) await expectReachable(control);
  }

  async function keyboardDetailsAndConfirmation() {
    const boards = page.getByRole("region", { name: "Boards", exact: true });
    const board = boards.locator("details").first();
    const summary = board.locator("summary");
    // Start in the document's natural tab order; do not bypass reachability
    // with programmatic focus or a mouse click.
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content", exact: true }),
    ).toBeFocused();
    await tabTo(summary);
    await expect(summary).toBeInViewport();
    expect(
      await summary.evaluate((element) => element.matches(":focus-visible")),
    ).toBe(true);
    await page.keyboard.press("Enter");
    await expect(board).toHaveAttribute("open", "");
    for (const control of [
      board.getByLabel("Board name", { exact: true }),
      board.getByRole("textbox", { name: /^Address/ }),
      board.getByRole("textbox", { name: "Board description", exact: true }),
      board.getByLabel("Display order", { exact: true }),
      board.getByRole("button", { name: "Save board", exact: true }),
      board.getByRole("button", { name: "Delete board", exact: true }),
    ]) {
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
      await expect(control).toBeInViewport();
    }
    const deletionRequests: string[] = [];
    const trackDelete = (request: Request) => {
      if (request.method() === "DELETE") deletionRequests.push(request.url());
    };
    page.on("request", trackDelete);
    const dialogHandled = new Promise<void>((resolve, reject) => {
      page.once("dialog", async (dialog) => {
        try {
          expect(dialog.type()).toBe("confirm");
          expect(dialog.message()).toContain("Delete board");
          // Playwright supplies Cancel via its dialog API. This checks keyboard
          // activation and cancellation, not a physical Escape key.
          await dialog.dismiss();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await page.keyboard.press("Enter");
    await dialogHandled;
    await expect(
      board.getByRole("button", { name: "Delete board", exact: true }),
    ).toBeFocused();
    await expect(boards.locator("details")).toHaveCount(4);
    expect(deletionRequests).toEqual([]);
    page.off("request", trackDelete);
    // Reverse traversal returns to the disclosure. Space closes it, then Tab
    // skips its hidden form and reaches the next board's disclosure.
    for (let index = 0; index < 6; index++)
      await page.keyboard.press("Shift+Tab");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Space");
    await expect(board).not.toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(
      boards.locator("details").nth(1).locator("summary"),
    ).toBeFocused();
  }

  async function tabTo(target: Locator) {
    for (let index = 0; index < 30; index++) {
      if (
        await target.evaluate((element) => element === document.activeElement)
      )
        break;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  }

  async function scan() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  }
});
