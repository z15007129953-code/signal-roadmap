import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const output = new URL("../.local/settings-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = () => page.waitForLoadState("networkidle");
try {
  await page.goto(origin);
  await settle();
  await page.getByRole("button", { name: "Start a private demo" }).click();
  await page.getByRole("link", { name: "Open your feedback board" }).click();
  await settle();
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await settle();
  const settingsUrl = page.url();
  await page.getByRole("heading", { name: "Workspace settings" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save branding" }).count(),
    0,
  );
  await page
    .locator("summary")
    .filter({ hasText: /^Add board$/ })
    .click();
  const boards = page.getByRole("region", { name: "Boards", exact: true });
  const newBoard = boards.locator("details").last();
  await newBoard.getByLabel("Board name").fill("Acceptance workflow");
  await newBoard.getByLabel("Address").fill("team-workflow");
  await newBoard
    .getByLabel("Board description")
    .fill("Ideas for day-to-day collaboration.");
  await newBoard.getByRole("button", { name: "Add board" }).click();
  await boards.locator("summary", { hasText: "Acceptance workflow" }).waitFor();
  await page.reload();
  await settle();
  await page
    .locator("summary")
    .filter({ hasText: /^Add tag$/ })
    .click();
  const tags = page.getByRole("region", { name: "Tags", exact: true });
  const newTag = tags.locator("details").last();
  await newTag.getByLabel("Tag name").fill("Acceptance tag");
  await newTag.getByLabel("Address").fill("acceptance-tag");
  await newTag.getByRole("button", { name: "Add tag" }).click();
  await tags.locator("summary", { hasText: "Acceptance tag" }).waitFor();
  await page.reload();
  await settle();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => v.id),
      [],
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`settings-${width}.png`, output)),
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await settle();
  await page.getByRole("link", { name: "Share feedback", exact: true }).click();
  await settle();
  await page
    .getByLabel("Title", { exact: true })
    .fill("A team workflow improvement");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Make daily planning easier to understand for the entire team.");
  await page
    .getByLabel("Board", { exact: true })
    .selectOption({ label: "Acceptance workflow" });
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("link", { name: "View your feedback" }).waitFor();
  await page.goto(settingsUrl);
  await settle();
  const board = page
    .getByRole("region", { name: "Boards", exact: true })
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: "Acceptance workflow" }),
    });
  await board.locator("summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await board.getByRole("button", { name: "Delete board" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    /board with feedback cannot be deleted/,
  );
  const tag = page
    .getByRole("region", { name: "Tags", exact: true })
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Acceptance tag" }) });
  await tag.locator("summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await tag.getByRole("button", { name: "Delete tag" }).click();
  await page
    .getByRole("region", { name: "Tags", exact: true })
    .locator("summary", { hasText: "Acceptance tag" })
    .waitFor({ state: "detached" });
  await page.reload();
  await settle();
  await page.getByRole("button", { name: "Return to member view" }).click();
  await page
    .getByRole("heading", { name: "This feedback is not available." })
    .waitFor();
  assert.deepEqual(errors, []);
  const report = [
    "Persisted board and tag creation",
    "390/768/1440 layout and accessibility",
    "Nonempty board deletion rejected; tag deletion persisted",
    "Member cannot access settings",
  ];
  await writeFile(
    new URL("report.json", output),
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: report.length, report }, null, 2));
} catch (error) {
  console.log(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
