import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const output = new URL("../.local/release-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = [];
const settle = () => page.waitForLoadState("networkidle");
try {
  await page.goto(origin);
  await settle();
  await page.getByRole("button", { name: "Start a private demo" }).click();
  await page.getByRole("link", { name: "Open your feedback board" }).click();
  await settle();
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page
    .getByRole("link", { name: "Write a release", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Share feedback", exact: true }).click();
  await settle();
  await page.getByLabel("Title", { exact: true }).fill("Useful saved searches");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Save a search so the whole team can come back to a clear view.");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("link", { name: "View your feedback" }).click();
  await settle();
  const detailUrl = page.url();
  await page.getByRole("button", { name: "Return to member view" }).click();
  await page.getByRole("button", { name: "Try moderator view" }).waitFor();
  await page.getByRole("button", { name: "Follow updates" }).click();
  await page.getByText("Following updates.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Try moderator view" }).click();
  await page.getByLabel("Roadmap status").selectOption("completed");
  const statusResponse = page.waitForResponse(
    (r) => r.url().endsWith("/moderation") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save status" }).click();
  assert.equal((await statusResponse).status(), 200);
  await page.getByRole("link", { name: "Roadmap", exact: true }).click();
  await settle();
  await page
    .locator("#completed")
    .getByRole("link", { name: "Useful saved searches" })
    .waitFor();
  report.push("Completed feedback appears in the correct roadmap section");
  await page
    .getByRole("link", { name: "Write a release", exact: true })
    .click();
  await settle();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Saved searches are here");
  await page
    .getByLabel("Summary", { exact: true })
    .fill("Return to the ideas that matter to your team.");
  await page
    .getByLabel("Release notes", { exact: true })
    .fill(
      "## A clearer daily view\n\nYou can now keep a search ready for your next planning session.",
    );
  await page.getByLabel("Useful saved searches", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page
    .getByText("Draft saved. Only moderators can see it.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Publish release" }).click();
  await page.getByRole("button", { name: "Confirm publication" }).click();
  await page.getByRole("link", { name: "Read published release" }).click();
  await settle();
  await page
    .getByRole("heading", { name: "Saved searches are here" })
    .waitFor();
  await page.getByRole("link", { name: "Useful saved searches" }).waitFor();
  const releaseUrl = page.url();
  await page.reload();
  await settle();
  await page
    .getByRole("heading", { name: "Saved searches are here" })
    .waitFor();
  report.push(
    "Draft publication, Markdown and completed feedback links persist",
  );
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
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
      path: fileURLToPath(new URL(`release-${width}.png`, output)),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Return to member view" }).click();
  await page.getByRole("button", { name: "Try moderator view" }).waitFor();
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await settle();
  const releaseLink = page.getByRole("link", {
    name: "Saved searches are here",
  });
  await releaseLink.waitFor();
  assert.equal(
    new URL(await releaseLink.getAttribute("href"), origin).href,
    releaseUrl,
  );
  report.push(
    "Follower receives a release notification linking to the published update",
  );
  await page.goto(detailUrl);
  await settle();
  assert.equal(
    await page
      .getByRole("heading", { name: "Make the next step clear." })
      .count(),
    0,
  );
  report.push("Member view cannot access moderator publishing controls");
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
