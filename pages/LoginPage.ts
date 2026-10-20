import { expect, type Locator, type Page } from '@playwright/test';
import { env } from '../config/env';

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.locator('input[name="User[username]"]');
    this.passwordInput = page.locator('input[name="User[password]"]');
    this.submitButton = page.locator('#loginBtn');
  }

  async goto() {
    await this.page.goto(env.loginPath);
    await this.expectVisible();
  }

  async login(username = env.username, password = env.password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    // The dev server sometimes takes well over 5s to answer the login POST (a grey
    // loader is shown meanwhile), so wait for the actual response before asserting.
    await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(env.loginPath) && r.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      this.submitButton.click(),
    ]);
    await this.page.waitForLoadState();
  }

  errorMessage(text: string) {
    return this.page.getByText(text);
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/\/users\/login/);
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
