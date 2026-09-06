import {
  test as base,
  expect,
  type Page,
  type Locator,
  type Response,
} from "@playwright/test";

export const acceptanceViewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

export async function expectReachable(control: Locator) {
  await control.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(control).toBeInViewport();
  // Trial clicks verify enabled state and hit testing without changing data.
  await control.click({ trial: true, timeout: 15000 });
}

export const demoIdeas = {
  source: {
    slug: "weekly-email-recap",
    title: "Send a weekly email recap for followed suggestions",
  },
  target: {
    slug: "weekly-progress-digest",
    title: "A weekly digest of the ideas I follow",
  },
} as const;

export type DemoWorkspace = {
  boardUrl: string;
  sourceUrl: string;
  targetUrl: string;
};

// Full document navigation can expose server-rendered controls before React
// attaches their handlers. The app has no background polling, so waiting for
// its initial requests to settle gives these real-browser actions a stable start.
export async function settlePage(page: Page) {
  await page.waitForLoadState("networkidle");
}

export async function expectSaved(
  page: Page,
  method: string,
  pathnameSuffix: string,
  action: () => Promise<unknown>,
): Promise<Response> {
  const pending = page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname.endsWith(pathnameSuffix),
  );
  await action();
  const response = await pending;
  expect(response.ok(), `${method} ${pathnameSuffix}`).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true });
  return response;
}

export async function startPrivateDemo(page: Page): Promise<DemoWorkspace> {
  await page.goto("/");
  await settlePage(page);
  await expectSaved(page, "POST", "/api/demo/start", () =>
    page
      .getByRole("button", { name: "Start a private demo", exact: true })
      .click(),
  );
  await page
    .getByRole("link", { name: "Open your feedback board", exact: true })
    .click();
  await settlePage(page);
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Viewing as member", { exact: true }),
  ).toBeVisible();
  const boardUrl = page.url();
  expect(new URL(boardUrl).pathname).toMatch(/^\/[^/]+\/feedback$/);
  return {
    boardUrl,
    sourceUrl: `${boardUrl}/${demoIdeas.source.slug}`,
    targetUrl: `${boardUrl}/${demoIdeas.target.slug}`,
  };
}

export const test = base.extend<{
  demo: DemoWorkspace;
  pageErrors: string[];
}>({
  pageErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await provide(errors);
      expect(errors, "No uncaught browser errors").toEqual([]);
    },
    { auto: true },
  ],
  demo: async ({ page }, provide) => {
    await provide(await startPrivateDemo(page));
  },
});

export { expect };
