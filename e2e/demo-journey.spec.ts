import { demoIdeas, expect, expectSaved, settlePage, test } from "./fixtures";

test("a private demo carries a member idea through moderation and a published release", async ({
  page,
  demo,
}) => {
  const ideaTitle = "Keep a short decision note beside each roadmap change";
  const comment =
    "A single Friday recap would help our support team explain progress without following every conversation each day.";
  const releaseTitle = "A quieter Friday, with progress in one place";
  const releaseSummary =
    "The weekly digest brings followed ideas and their latest decisions into one useful update.";
  let submittedUrl = "";
  let releaseUrl = "";

  await test.step("submit an original member idea into private review", async () => {
    await page
      .getByRole("link", { name: "Share feedback", exact: true })
      .click();
    await settlePage(page);
    await page.getByLabel("Title", { exact: true }).fill(ideaTitle);
    await page
      .getByLabel("Description", { exact: true })
      .fill(
        "When an idea changes direction, a short decision note would help our team understand the reason and share an accurate update with customers.",
      );
    await expectSaved(page, "POST", "/feedback", () =>
      page.getByRole("button", { name: "Send feedback", exact: true }).click(),
    );
    await expect(
      page.getByRole("heading", {
        name: "Your feedback is awaiting review.",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "View your feedback", exact: true })
      .click();
    await settlePage(page);
    submittedUrl = page.url();
    await expect(
      page.getByRole("heading", { name: ideaTitle, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Awaiting review", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Vote/ })).toHaveCount(0);
    await expect(page.getByLabel("Your comment", { exact: true })).toHaveCount(
      0,
    );
  });

  await test.step("support both seeded duplicates and follow their progress", async () => {
    await page.goto(demo.sourceUrl);
    await settlePage(page);
    await expect(
      page.getByRole("heading", { name: demoIdeas.source.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Vote · 3", exact: true }),
    ).toBeVisible();
    await expectSaved(page, "PUT", "/vote", () =>
      page.getByRole("button", { name: "Vote · 3", exact: true }).click(),
    );
    await expect(
      page.getByRole("button", { name: "Voted · 4", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Your comment", { exact: true }).fill(comment);
    await expectSaved(page, "POST", "/comments", () =>
      page.getByRole("button", { name: "Post comment", exact: true }).click(),
    );
    await expect(
      page.getByText("Comment posted.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: comment }),
    ).toContainText("Demo member");

    await page.goto(demo.targetUrl);
    await settlePage(page);
    await expectSaved(page, "PUT", "/vote", () =>
      page.getByRole("button", { name: "Vote · 2", exact: true }).click(),
    );
    await expect(
      page.getByRole("button", { name: "Voted · 3", exact: true }),
    ).toBeVisible();
    // This member follows the target in the seed. Toggle it off and back on so
    // acceptance covers a real Follow updates write as well as its persistence.
    await expectSaved(page, "PUT", "/follow", () =>
      page
        .getByRole("button", { name: "Following updates", exact: true })
        .click(),
    );
    await expectSaved(page, "PUT", "/follow", () =>
      page.getByRole("button", { name: "Follow updates", exact: true }).click(),
    );
    await expect(
      page.getByRole("button", { name: "Following updates", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("approve the member submission as moderator", async () => {
    await page.goto(submittedUrl);
    await settlePage(page);
    await expectSaved(page, "POST", "/api/demo/persona", () =>
      page
        .getByRole("button", { name: "Try moderator view", exact: true })
        .click(),
    );
    await expect(
      page.getByText("Viewing as moderator", { exact: true }),
    ).toBeVisible();
    await expectSaved(page, "POST", "/moderation", () =>
      page
        .getByRole("button", { name: "Approve and publish", exact: true })
        .click(),
    );
    await expect(
      page.getByLabel("Roadmap status", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await settlePage(page);
    await expect(
      page.getByRole("heading", { name: "Awaiting review", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Vote · 0", exact: true }),
    ).toBeVisible();
  });

  await test.step("merge duplicates without double-counting supporters or losing attribution", async () => {
    await page.goto(demo.sourceUrl);
    await settlePage(page);
    await page.getByText("Merge a duplicate", { exact: true }).click();
    await page
      .getByLabel("Find the idea to keep", { exact: true })
      .fill(demoIdeas.target.title);
    await page
      .getByRole("button", { name: "Find matches", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `Keep ${demoIdeas.target.title}`,
        exact: true,
      })
      .click();
    const confirmation = page.getByRole("group", {
      name: "Confirm merge",
      exact: true,
    });
    await expect(confirmation).toContainText(demoIdeas.source.title);
    await expect(confirmation).toContainText(demoIdeas.target.title);
    await expectSaved(page, "POST", "/moderation", () =>
      confirmation
        .getByRole("button", {
          name: `Merge into ${demoIdeas.target.title}`,
          exact: true,
        })
        .click(),
    );
    await expect(page).toHaveURL(demo.targetUrl);
    await settlePage(page);
    await page.goto(demo.sourceUrl);
    await expect(page).toHaveURL(demo.targetUrl);
    await settlePage(page);
    const history = page.getByRole("region", {
      name: "Earlier conversations",
      exact: true,
    });
    const retainedComment = history
      .getByRole("listitem")
      .filter({ hasText: comment });
    await expect(retainedComment).toHaveCount(1);
    await expect(retainedComment).toContainText(
      `From “${demoIdeas.source.title}”`,
    );
    await expect(retainedComment).toContainText("Demo member");
    await expect(retainedComment.getByRole("button")).toHaveCount(0);
    // The source's three seeded supporters include the target's two; the same
    // demo member voted on both. The union is four people, never seven votes.
    await expect(
      page.getByRole("button", { name: "Vote · 4", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Roadmap status", { exact: true })
      .selectOption("completed");
    await expectSaved(page, "POST", "/moderation", () =>
      page.getByRole("button", { name: "Save status", exact: true }).click(),
    );
    await expect(
      page.getByRole("button", { name: "Save status", exact: true }),
    ).toBeDisabled();
  });

  await test.step("publish original release notes linked to the completed roadmap item", async () => {
    await page.getByRole("link", { name: "Roadmap", exact: true }).click();
    await settlePage(page);
    await expect(
      page
        .locator("#completed")
        .getByRole("link", { name: demoIdeas.target.title, exact: true }),
    ).toHaveAttribute("href", new URL(demo.targetUrl).pathname);
    await page
      .getByRole("link", { name: "Write a release", exact: true })
      .click();
    await settlePage(page);
    await page.getByLabel("Title", { exact: true }).fill(releaseTitle);
    await page.getByLabel("Summary", { exact: true }).fill(releaseSummary);
    await page
      .getByLabel("Release notes", { exact: true })
      .fill(
        "## Catch up in one sitting\n\nYour Friday digest now gathers status changes and discussion highlights from the ideas you follow. Each item links back to the original conversation.\n\nA quiet week stays quiet: when nothing changes, there is no email. Thank you to the community members who helped bring these related suggestions together.",
      );
    await page.getByLabel(demoIdeas.target.title, { exact: true }).check();
    await expectSaved(page, "POST", "/changelog", () =>
      page.getByRole("button", { name: "Save draft", exact: true }).click(),
    );
    await expect(
      page.getByText("Draft saved. Only moderators can see it.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Publish release", exact: true })
      .click();
    await expectSaved(page, "POST", "/publish", () =>
      page
        .getByRole("button", { name: "Confirm publication", exact: true })
        .click(),
    );
    await page
      .getByRole("link", { name: "Read published release", exact: true })
      .click();
    await settlePage(page);
    releaseUrl = page.url();
    await expect(
      page.getByRole("heading", { name: releaseTitle, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Catch up in one sitting",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: demoIdeas.target.title, exact: true }),
    ).toHaveAttribute("href", new URL(demo.targetUrl).pathname);
    await page.getByRole("link", { name: "Changelog", exact: true }).click();
    await settlePage(page);
    await expect(
      page.getByRole("link", { name: releaseTitle, exact: true }),
    ).toHaveAttribute("href", new URL(releaseUrl).pathname);
    await expect(page.getByText(releaseSummary, { exact: true })).toBeVisible();
  });

  await test.step("deliver a persistent notification to the member following the idea", async () => {
    await expectSaved(page, "POST", "/api/demo/persona", () =>
      page
        .getByRole("button", { name: "Return to member view", exact: true })
        .click(),
    );
    await expect(
      page.getByText("Viewing as member", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Write a release", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Notifications", exact: true })
      .click();
    await settlePage(page);
    const notice = page.getByRole("listitem").filter({
      has: page.getByRole("link", { name: releaseTitle, exact: true }),
    });
    await expect(notice).toHaveCount(1);
    const releaseLink = notice.getByRole("link", {
      name: releaseTitle,
      exact: true,
    });
    await expect(releaseLink).toHaveAttribute(
      "href",
      new URL(releaseUrl).pathname,
    );
    await releaseLink.click();
    await settlePage(page);
    await expect(page).toHaveURL(releaseUrl);
    await expect(
      page.getByRole("heading", { name: releaseTitle, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: demoIdeas.target.title, exact: true })
      .click();
    await settlePage(page);
    await expect(
      page.getByRole("button", { name: "Voted · 4", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Following updates", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByLabel("Roadmap status", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Make the next step clear.",
        exact: true,
      }),
    ).toHaveCount(0);
  });
});
