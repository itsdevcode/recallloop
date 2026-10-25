import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const widths = [320, 375, 390, 768, 1024, 1440];

test("public launch pages and authenticated workspace fit all release widths", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your bookmarks deserve a second life.",
  );
  await expect(
    page.getByRole("link", { name: "See How It Works" }),
  ).toHaveAttribute("href", "#how-it-works");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `landing at ${width}px`,
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Start Remembering" }).first(),
    ).toBeVisible();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: testInfo.outputPath(`landing-${width}.png`),
        fullPage: true,
      });
  }
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your reading, your data.",
  );
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/register");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
  }
  const email = `launch-${randomUUID()}@example.com`;
  const password = "LaunchBrowserPassword123!";
  await page.getByLabel("Name", { exact: true }).fill("Curious Reader");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Curious Reader." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your recall queue is empty.", { exact: false }),
  ).toBeVisible();
  for (const route of [
    "/dashboard",
    "/dashboard/articles",
    "/dashboard/review",
    "/dashboard/schedule",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("navigation", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
      if (route === "/dashboard" && width === 1440)
        await page.screenshot({
          path: testInfo.outputPath("dashboard-1440.png"),
          fullPage: true,
        });
    }
  }
  // Complete the release journey with the real local worker and mocked AI.
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByLabel("Save an article", { exact: true })
    .fill(`https://example.com/browser-launch-${randomUUID()}`);
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Learning that lasts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Key ideas & recall questions" }),
  ).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `article at ${width}px`,
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Today's Recall", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show Answer", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show Answer", exact: true }).click();
  await expect(page.getByLabel("Answer", { exact: true })).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `recall at ${width}px`,
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("recall-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Easy", exact: true }).click();
  await expect(page.getByText("Reviewed 1 of 3 in this batch")).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const summary = page.getByRole("region", { name: "Today's Recall" });
  await expect(summary.locator("dd").first()).toHaveText("2");
  await expect(summary.locator("dd").nth(1)).toHaveText("1");
  await page
    .getByRole("link", { name: "Review Schedule", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review history (1)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
