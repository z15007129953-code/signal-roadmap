import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const output = new URL("../.local/persisted-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = [];
try {
  await page.goto(origin);
  await page.getByRole("button", { name: "Start a private demo" }).click();
  await page.getByRole("link", { name: "Open your feedback board" }).click();
  await page.waitForURL(/\/demo-[^/]+\/feedback$/);
  const boardUrl = page.url();
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page.getByRole("button", { name: "Return to member view" }).waitFor();
  await page.getByRole("link", { name: "Share feedback" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Make feedback easier to find");
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Help the community find related ideas using clear search and filters.",
    );
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("link", { name: "View your feedback" }).click();
  const detailUrl = page.url();
  await page
    .getByRole("heading", { name: "Make feedback easier to find" })
    .waitFor();
  report.push("Moderator creates published feedback through the UI");
  await page.getByRole("button", { name: /^Vote ·/ }).click();
  await page.getByRole("button", { name: /^Voted · 1/ }).waitFor();
  await page.getByRole("button", { name: "Follow updates" }).click();
  await page.getByText("Following updates.", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /^Voted · 1/ }).waitFor();
  await page.getByRole("button", { name: "Following updates" }).waitFor();
  report.push("Votes and follows persist after reload");
  await page.getByRole("button", { name: "Return to member view" }).click();
  await page.getByRole("button", { name: "Try moderator view" }).waitFor();
  await page
    .getByLabel("Your comment")
    .fill("A search example would help our team.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await page.getByText("Comment posted.", { exact: true }).waitFor();
  await page
    .getByText("A search example would help our team.", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByText("A search example would help our team.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Edit comment", { exact: true })
    .fill("A saved search example would help our team.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Comment updated.", { exact: true }).waitFor();
  await page
    .getByText("A saved search example would help our team.", { exact: true })
    .waitFor();
  report.push("Member comment creation and editing persist");
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
      path: fileURLToPath(new URL(`discussion-${width}.png`, output)),
      fullPage: true,
    });
  }
  report.push(
    "Real discussion has no scanned A/AA violations or horizontal overflow at 375/1440px",
  );
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page.getByRole("button", { name: "Return to member view" }).waitFor();
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await page
    .getByRole("link", { name: "Make feedback easier to find" })
    .waitFor();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Mark as read" }).click();
  await page.getByText("0 unread updates").waitFor();
  await page.reload();
  await page.getByText("0 unread updates").waitFor();
  report.push(
    "Follower notification arrives for the other persona and read state persists",
  );
  const outsider = await browser.newContext();
  const otherPage = await outsider.newPage();
  await otherPage.goto(detailUrl);
  assert.equal(
    await otherPage
      .getByRole("heading", { name: "Make feedback easier to find" })
      .count(),
    0,
  );
  await outsider.close();
  report.push("A fresh browser cannot read this private demo");
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("report.json", output),
    JSON.stringify({ checks: report, boardUrl, detailUrl, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: report.length, report }, null, 2));
} catch (error) {
  console.log(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
