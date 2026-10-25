import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("register, login, protected profile and logout through the same-origin proxy", async ({
  page,
  context,
}) => {
  const email = `browser-${randomUUID()}@example.com`;
  const password = "BrowserTestPassword123!";

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Welcome,", { exact: false })).toHaveCount(0);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Start Remembering", exact: false })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Browser User");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);

  await page.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toHaveText("Invalid email or password");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Browser User." }),
  ).toBeVisible();

  const cookie = (await context.cookies()).find(
    (item) => item.name === "recallloop_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "recallloop_session",
  );
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  // A same-origin mutation is still rejected when its custom CSRF header is missing.
  expect(
    await page.evaluate(
      async () => (await fetch("/api/auth/logout", { method: "POST" })).status,
    ),
  ).toBe(403);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome, Browser User." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some(
      (item) => item.name === "recallloop_session",
    ),
  ).toBe(false);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
