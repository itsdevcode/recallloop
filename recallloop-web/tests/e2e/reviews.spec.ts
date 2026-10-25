import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile recall session hides answers, retries one committed review safely, and schedules all ratings", async ({
  page,
}) => {
  await page.goto("/dashboard/review");
  await expect(page).toHaveURL(/\/login$/);
  const account = {
    name: "Recall Learner",
    email: `recall-${randomUUID()}@example.com`,
    password: "RecallBrowserPassword123!",
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
  const article = await (
    await page.request.post("/api/articles", {
      headers,
      data: { url: `https://example.com/browser-review-${randomUUID()}` },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/articles/${article.id}`)).json())
          .status,
    )
    .toBe("READY");
  await page.goto("/dashboard");
  const summary = page.getByRole("region", { name: "Today's Recall" });
  await expect(summary.locator("dd").first()).toHaveText("3");
  const initial = page.waitForResponse((response) =>
    response.url().includes("/api/reviews/due?limit=50"),
  );
  await page.getByRole("link", { name: "Start Recall", exact: true }).click();
  const due = await (await initial).json();
  expect(due.items).toHaveLength(3);
  for (const card of due.items) expect(card).not.toHaveProperty("answer");
  await expect(page.getByLabel("Answer", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Easy", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.route(
    "**/api/reviews/cards/*/answer",
    async (route) => {
      await route.fulfill({
        status: 503,
        json: { detail: "Temporary answer outage" },
      });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Show Answer", exact: true }).click();
  await expect(
    page.getByText(
      "Unable to reveal the answer. Try again or reload the due queue.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show Answer", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Answer", { exact: true })).toBeVisible();

  const keys: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/reviews/cards/")
    )
      keys.push(request.headers()["idempotency-key"]);
  });
  // Commit the real review, then drop its acknowledgment to exercise replay safety.
  await page.route(
    "**/api/reviews/cards/*",
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({
        status: 502,
        json: { detail: "Acknowledgment lost" },
      });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Forgot", exact: true }).click();
  await expect(
    page.getByText(/We couldn't confirm the review was saved/),
  ).toBeVisible();
  await expect(page.getByText("Reviewed 0 of 3 in this batch")).toBeVisible();
  await page
    .getByRole("button", { name: "Retry saving review", exact: true })
    .click();
  await expect(page.getByText("Reviewed 1 of 3 in this batch")).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByLabel("Answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show Answer", exact: true }).click();
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await expect(page.getByText("Reviewed 2 of 3 in this batch")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recall batch complete" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show Answer", exact: true }).click();
  await page.getByRole("button", { name: "Easy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recall batch complete", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total reviewed: 3", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("You're all caught up for now.", { exact: true }),
  ).toBeVisible();
  const stats = await (await page.request.get("/api/reviews/stats")).json();
  expect(stats.reviewed_today).toBe(3);
  expect(stats.total_completed_reviews).toBe(3);
  expect(stats.due_now).toBe(0);
  const history = await (await page.request.get("/api/reviews/history")).json();
  expect(history.total).toBe(3);
  expect(
    new Set(history.items.map((log: { rating: string }) => log.rating)),
  ).toEqual(new Set(["FORGOT", "HARD", "EASY"]));
  await page
    .getByRole("link", { name: "Review Schedule", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review history (3)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Upcoming reviews · next 7 UTC dates",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByText(/You're all caught up. Next review:/),
  ).toBeVisible();
  const updated = page.getByRole("region", { name: "Today's Recall" });
  await expect(updated.locator("dd").first()).toHaveText("0");
  await expect(updated.locator("dd").nth(1)).toHaveText("3");
});
