import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const configured = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname));
assert.equal(process.env.NODE_ENV, "development");
const sql = postgres(configured.href, { max: 1 });
const w = randomUUID(),
  owner = randomUUID(),
  member = randomUUID();
const token = randomBytes(32).toString("hex");
const slug = `owner-check-${w}`;
const output = new URL("../.local/settings-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = () => page.waitForLoadState("networkidle");
try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO users (id,name) VALUES (${owner},'Test owner'),(${member},'Test member')`;
    await tx`INSERT INTO workspaces (id,slug,name) VALUES (${w},${slug},'Owner verification workspace')`;
    await tx`INSERT INTO members (workspace_id,user_id,display_name,role) VALUES (${w},${owner},'Test owner','owner'),(${w},${member},'Test member','member')`;
    await tx`INSERT INTO sessions (session_token,user_id,expires) VALUES (${token},${owner},now() + interval '30 minutes')`;
  });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`${origin}/${slug}/admin/settings`);
  await settle();
  await page.getByLabel("Workspace name").fill("The planning room");
  await page
    .getByLabel("Public description")
    .fill("A shared place for thoughtful product decisions.");
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await settle();
  await expect(page.getByLabel("Workspace name")).toHaveValue(
    "The planning room",
  );
  await page.getByLabel("Role for Test member").selectOption("moderator");
  const memberForm = page
    .locator("form")
    .filter({ has: page.getByLabel("Role for Test member") });
  page.once("dialog", (dialog) => dialog.accept());
  await memberForm.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await settle();
  await expect(page.getByLabel("Role for Test member")).toHaveValue(
    "moderator",
  );
  await page.getByLabel("Role for Test owner").selectOption("member");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Role for Test owner") })
    .getByRole("button", { name: "Save role" })
    .click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    /last owner must stay an owner/,
  );
  await page.reload();
  await settle();
  await expect(page.getByLabel("Role for Test owner")).toHaveValue("owner");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
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
      path: fileURLToPath(new URL(`owner-${width}.png`, output)),
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await settle();
  await expect(
    page.getByText("The planning room", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A shared place for thoughtful product decisions.", {
      exact: true,
    }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "Owner settings: persisted branding, member promotion, last-owner rejection, and three viewport accessibility checks passed.",
  );
} catch (error) {
  console.log(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
  await sql`DELETE FROM workspaces WHERE id=${w}`;
  await sql`DELETE FROM users WHERE id IN (${owner},${member})`;
  await sql.end();
}
