import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Use the installed toolchain; no browser or dependency downloads.
const require = createRequire(import.meta.resolve("vitest"));
const { createServer } = await import(require.resolve("vite"));
const root = fileURLToPath(new URL("../", import.meta.url));
const output = `${root}.local/browser-qa`;
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: `${root}tests/browser`,
  resolve: { alias: { "@": `${root}src` } },
  server: {
    host: "127.0.0.1",
    port: 3101,
    strictPort: true,
    fs: { allow: [root] },
  },
});
let browser;
const report = [];
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function inspect(name, url, width, scheme = "light") {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(url);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      geometry.scroll <= geometry.width,
      `${name}: horizontal overflow`,
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const violations = audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    report.push({ name, geometry, violations });
    assert.equal(
      violations.length,
      0,
      `${name}: accessibility violations ${JSON.stringify(violations)}`,
    );
  }
  await inspect("home-desktop", "http://127.0.0.1:3100", 1440);
  await inspect("home-mobile", "http://127.0.0.1:3100", 375);
  await inspect("home-dark", "http://127.0.0.1:3100", 1440, "dark");
  await page.getByRole("button", { name: "Start a private demo" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("alert")
    .filter({ hasText: "could not be created" })
    .waitFor();
  report.push({
    name: "unconfigured-home-demo",
    result: "Recoverable error displayed; no database success claimed",
  });
  for (const [mode, width, scheme] of [
    ["list", 1440, "light"],
    ["list", 375, "light"],
    ["list", 320, "dark"],
    ["detail", 375, "light"],
    ["form", 375, "light"],
    ["form", 1440, "dark"],
    ["empty", 375, "light"],
  ]) {
    await inspect(
      `${mode}-${width}-${scheme}`,
      `http://127.0.0.1:3101/?mode=${mode}`,
      width,
      scheme,
    );
  }
  await page.goto("http://127.0.0.1:3101/?mode=form");
  await page.getByRole("button", { name: "Send feedback" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("alert")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("link", { name: /Title needs/ }).click();
  assert.equal(
    await page
      .getByLabel("Title", { exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({
    path: `${output}/form-validation.png`,
    fullPage: true,
  });
  const validationAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    validationAudit.violations.map((v) => v.id),
    [],
    "Validation accessibility",
  );
  await page.route("**/api/workspaces/fixture/feedback", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        value: { slug: "export-reports", visibility: "pending" },
      }),
    }),
  );
  await page
    .getByLabel("Title", { exact: true })
    .fill("Export reports for the team");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A downloadable weekly report would help the whole team.");
  await page.getByRole("button", { name: "Send feedback" }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Your feedback is awaiting review.").waitFor();
  assert.equal(
    await page
      .getByRole("status")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({ path: `${output}/form-pending.png`, fullPage: true });
  report.push({
    name: "keyboard-form",
    result:
      "Validation focus, field link and mocked pending confirmation passed",
  });
  await page.unroute("**/api/workspaces/fixture/feedback");
  let finishRequest;
  await page.route("**/api/workspaces/fixture/feedback", async (route) => {
    await new Promise((resolve) => {
      finishRequest = resolve;
    });
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { code: "DEMO_QUOTA_EXCEEDED" },
      }),
    });
  });
  await page.goto("http://127.0.0.1:3101/?mode=form");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Export reports for the team");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A downloadable weekly report would help the whole team.");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("button", { name: "Sending feedback…" }).waitFor();
  assert.equal(
    await page.getByLabel("Title", { exact: true }).isDisabled(),
    true,
  );
  await page.screenshot({ path: `${output}/form-sending.png`, fullPage: true });
  finishRequest();
  await page.getByRole("alert").filter({ hasText: "usage limit" }).waitFor();
  assert.equal(
    await page.getByLabel("Description", { exact: true }).inputValue(),
    "A downloadable weekly report would help the whole team.",
  );
  const failureAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    failureAudit.violations.map((v) => v.id),
    [],
    "Quota failure accessibility",
  );
  await page.screenshot({ path: `${output}/form-quota.png`, fullPage: true });
  report.push({
    name: "loading-and-quota",
    result:
      "Disabled sending state and preserved draft after mocked quota failure passed",
  });
  for (const mode of ["list", "form", "detail"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:3101/?mode=${mode}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      bodyRight: document.body.getBoundingClientRect().right,
    }));
    assert.ok(
      geometry.bodyRight <= geometry.width,
      `${mode}: 2x CSS zoom overflow`,
    );
    await page.screenshot({
      path: `${output}/${mode}-css-zoom-200.png`,
      fullPage: true,
    });
    report.push({
      name: `${mode}-css-zoom-200`,
      geometry,
      result:
        "CSS zoom simulation only; native browser zoom and real devices remain untested",
    });
  }
  await page.goto("http://127.0.0.1:3101/?mode=list");
  await page.getByLabel("Search feedback").fill("keyboard");
  await page.getByLabel("Status", { exact: true }).selectOption("planned");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "keyboard");
  assert.equal(new URL(page.url()).searchParams.get("status"), "planned");
  report.push({
    name: "filter-navigation",
    result: "Native GET form preserves search and status",
  });
  assert.deepEqual(errors, [], "Browser runtime errors");
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
console.log(
  JSON.stringify({ checks: report.length, output, results: report }, null, 2),
);
