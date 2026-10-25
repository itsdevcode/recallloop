import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile article library: protect, add, read, errors, retry and confirmed deletion", async ({
  page,
}) => {
  await page.goto("/dashboard/articles");
  await expect(page).toHaveURL(/\/login$/);
  const account = {
    name: "Article Reader",
    email: `articles-${randomUUID()}@example.com`,
    password: "BrowserArticlePassword123!",
  };
  const headers = {
    Origin: "http://127.0.0.1:13000",
    "X-CSRF-Protection": "1",
  };
  expect(
    (
      await page.request.post("/api/auth/register", { headers, data: account })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", { headers, data: account })
    ).status(),
  ).toBe(200);
  await page.goto("/dashboard/articles");
  await expect(
    page.getByRole("heading", { name: "Your library starts here" }),
  ).toBeVisible();
  const url = `https://example.com/browser-${randomUUID()}`;
  // Hold the first list snapshot at PENDING to test that view deterministically;
  // queue delivery, worker execution and subsequent polling still use real services.
  await page.route(
    "**/api/articles",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect(response.status()).toBe(202);
      const saved = await response.json();
      expect(saved.status).toBe("PENDING");
      await page.route(
        "**/api/articles?**",
        async (listRoute) => {
          await listRoute.fulfill({
            json: { items: [saved], total: 1, limit: 10, offset: 0 },
          });
        },
        { times: 1 },
      );
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.getByLabel("Save an article", { exact: true }).fill(url);
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Learning that lasts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save article", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("PROCESSING", { exact: true })).toBeVisible();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Learning that lasts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Learning that lasts" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Active recall helps learners/, { exact: false }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read original article" }),
  ).toHaveAttribute("href", url);
  await expect(
    page.getByText("Your cards are ready for active recall."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Key ideas & recall questions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Active recall", exact: true }),
  ).toBeVisible();
  await page.getByText("Reveal answer", { exact: true }).first().click();
  await expect(
    page.getByText(
      "It helps learners remember important concepts by recalling them.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to library" }).click();
  await page.getByLabel("Save an article", { exact: true }).fill(url);
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await expect(
    page.getByText("This article is already saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry loading articles" }).click();
  await expect(
    page.getByText("This article is already saved", { exact: true }),
  ).toHaveCount(0);
  // Force one transient list failure, then retry against the real API.
  await page.route(
    "**/api/articles?**",
    async (route) => {
      await route.fulfill({
        status: 503,
        json: { detail: "Temporary library outage" },
      });
    },
    { times: 1 },
  );
  await page.reload();
  await expect(
    page.getByText("Temporary library outage", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry loading articles" }).click();
  await expect(
    page.getByRole("link", { name: "Learning that lasts", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Confirm deletion" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Learning that lasts", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your library starts here" }),
  ).toBeVisible();
  await page
    .getByLabel("Save an article", { exact: true })
    .fill("https://example.com/browser-failed");
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await expect(page.getByText("FAILED", { exact: true })).toBeVisible();
  await page
    .getByRole("link", {
      name: "https://example.com/browser-failed",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("The fixture website could not be accessed.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry processing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Key ideas & recall questions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Learning that lasts", exact: true }),
  ).toBeVisible();
});
