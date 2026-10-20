import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The logged-in application chrome (top navbar / user menu). Shared by every module.
 */
export class AppShell {
  readonly welcomeBanner: Locator;
  readonly userMenuToggle: Locator;
  readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    this.welcomeBanner = page.locator('.navbar-right-content').filter({ hasText: /Welcome/ });
    this.userMenuToggle = page
      .locator('.navbar-right-content [data-toggle="dropdown"]')
      .filter({ hasText: 'person' });
    this.logoutLink = page.locator('.navbar-right-content a[href="/users/logout"]');
  }

  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/users\/login/);
    await expect(this.welcomeBanner).toBeVisible();
    await expect(this.userMenuToggle).toBeVisible();
  }

  async expectLoggedInAs(role: string) {
    await this.expectLoggedIn();
    await expect(this.welcomeBanner).toContainText(`you are ${role}`);
  }

  async logout() {
    // Requests still in flight when logging out can finish afterwards and keep the session
    // alive (seen on a slow server: /users/login then redirects to the dashboard). Let the page settle.
    await this.page.waitForLoadState('networkidle');

    // A modal jQuery UI dialog left open by a test covers the navbar; close it first.
    const dialogClose = this.page.locator('.ui-dialog:visible .ui-dialog-titlebar-close:visible');
    while (await dialogClose.count()) {
      await dialogClose.first().click();
    }
    // Some dialogs can't be closed (e.g. the sale page's "select depo" prompt): leave the page.
    if (await this.page.locator('.ui-dialog:visible').count()) {
      await this.page.goto('/users/dashboard');
      await this.page.waitForLoadState('networkidle');
    }
    await this.userMenuToggle.click();
    await this.logoutLink.click();
    await expect(this.page).toHaveURL(/\/users\/login/);
  }
}
