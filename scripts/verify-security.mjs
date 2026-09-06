import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const violations = [];
page.on("console", (message) => {
  if (
    /violates.*Content Security Policy|Refused to (execute|load|connect)/i.test(
      message.text(),
    )
  )
    violations.push(message.text());
});
try {
  const home = await page.goto(origin);
  const headers = home.headers();
  assert.ok(headers["content-security-policy"].includes("'strict-dynamic'"));
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.ok(headers["x-request-id"]);
  await page.waitForLoadState("networkidle");
  assert.ok(await page.locator("script[nonce]").count());
  await page.goto(`${origin}/signal-roadmap/feedback`);
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("link", {
      name: "A weekly digest of the ideas I follow",
      exact: true,
    })
    .waitFor();
  await page.goto(`${origin}/api/auth/signin`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").waitFor();
  await page.goto(`${origin}/signal-roadmap/admin/settings`);
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "You do not have access to this page." })
    .waitFor();
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
    assert.deepEqual(audit.violations, []);
  }
  const forbidden = await context.request.post(
    `${origin}/api/workspaces/signal-roadmap/feedback`,
    { headers: { origin: "https://attacker.invalid" }, data: {} },
  );
  assert.equal(forbidden.status(), 403);
  assert.equal(
    (await forbidden.json()).error.requestId,
    forbidden.headers()["x-request-id"],
  );
  await page.goto(`${origin}/page/that/does/not/exist`);
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "That page could not be found." })
    .waitFor();
  assert.deepEqual(violations, []);
  console.info(
    JSON.stringify(
      {
        passed: 5,
        checks: [
          "CSP nonce and security headers",
          "Seeded public board and sign-in render",
          "Forbidden state at three viewports with axe",
          "Correlated API rejection",
          "Not-found recovery without CSP violations",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
