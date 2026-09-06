import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const output = new URL("../.local/moderation-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = [];
async function settle() {
  await page.waitForLoadState("networkidle");
}
async function submit(title) {
  await page.getByRole("link", { name: "Share feedback", exact: true }).click();
  await settle();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Keep related ideas together so the team can make a clear product decision.",
    );
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("link", { name: "View your feedback" }).click();
  await settle();
}
try {
  await page.goto(origin);
  await settle();
  await page.getByRole("button", { name: "Start a private demo" }).click();
  await page.getByRole("link", { name: "Open your feedback board" }).click();
  await settle();
  const boardUrl = page.url();
  await submit("Save filters for the whole team");
  const sourceUrl = page.url();
  await page.getByRole("heading", { name: "Awaiting review" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^Vote/ }).count(), 0);
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await page.getByLabel("Roadmap status").waitFor();
  await page.reload();
  await settle();
  assert.equal(
    await page.getByRole("heading", { name: "Awaiting review" }).count(),
    0,
  );
  report.push(
    "Member submission is private and cannot receive votes until moderator approval",
  );
  await page
    .getByLabel("Your comment")
    .fill("This source discussion should stay attributable after merging.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await page.getByText("Comment posted.", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Vote ·/ }).click();
  await page.getByText("Vote added.", { exact: true }).waitFor();
  await page.goto(boardUrl);
  await settle();
  await submit("Shared saved views");
  const targetUrl = page.url();
  await page.goto(sourceUrl);
  await settle();
  await page.getByText("Merge a duplicate", { exact: true }).click();
  await page.getByLabel("Find the idea to keep").fill("Shared saved views");
  await page.getByRole("button", { name: "Find matches" }).click();
  await page.getByRole("button", { name: "Keep Shared saved views" }).click();
  assert.ok(
    await page
      .getByRole("group", { name: "Confirm merge" })
      .getByText("“Save filters for the whole team”", { exact: true })
      .count(),
  );
  await page
    .getByRole("button", { name: "Merge into Shared saved views" })
    .click();
  await page.waitForURL(targetUrl);
  await settle();
  await page.getByRole("heading", { name: "Earlier conversations" }).waitFor();
  await page
    .getByText(
      "This source discussion should stay attributable after merging.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("button", { name: /^Voted · 1/ }).waitFor();
  await page.goto(sourceUrl);
  await page.waitForURL(targetUrl);
  report.push(
    "Merge transfers a vote, retains source discussion, and redirects the old URL",
  );
  await page.getByLabel("Roadmap status").selectOption("completed");
  await page.getByRole("button", { name: "Save status" }).click();
  await page.getByText("Completed", { exact: true }).first().waitFor();
  await page.reload();
  await settle();
  assert.equal(
    await page.getByLabel("Roadmap status").inputValue(),
    "completed",
  );
  report.push("Moderator status decisions persist after reload");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => v.id),
      [],
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`moderation-${width}.png`, output)),
      fullPage: true,
    });
  }
  report.push(
    "Moderator controls and merged history pass scanned accessibility and width checks",
  );
  assert.deepEqual(errors, []);
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
