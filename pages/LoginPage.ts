import { expect, type Locator, type Page } from '@playwright/test';
import { env } from '../config/env';

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  /** "OR" between the Login button and the single sign-on buttons. */
  readonly orSeparator: Locator;
  /** Google sign-in (shown when the setting google_signin is 1): an icon linking to Google. */
  readonly googleSignIn: Locator;
  /** Microsoft sign-in (setting microsoft_signin); not shown on dev. */
  readonly microsoftSignIn: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.locator('input[name="User[username]"]');
    this.passwordInput = page.locator('input[name="User[password]"]');
    this.submitButton = page.locator('#loginBtn');
    this.orSeparator = page.getByText('OR', { exact: true });
    this.googleSignIn = page.getByRole('link').filter({ has: page.getByAltText(/google sign ?in/i) });
    this.microsoftSignIn = page
      .getByRole('link')
      .filter({ has: page.getByAltText(/microsoft/i) })
      .or(page.locator('a[href*="login.microsoftonline.com"]'));
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

  /** The error banner at the top. (Since Oct 2026 the message is also repeated in red under the form.) */
  errorMessage(text: string) {
    return this.page.locator('#flash_message').getByText(text);
  }

  /** A login error shown anywhere on the page (e.g. "Invalid request url." for refused logins). */
  message(text: string) {
    return this.page.getByText(text).first();
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/\/users\/login/);
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
