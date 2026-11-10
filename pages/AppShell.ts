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
    // Found by its icon, not by Bootstrap's toggle attribute: that changed from data-toggle to
    // data-bs-toggle in the Bootstrap 5 upgrade (Oct 2026) and broke every login check.
    this.userMenuToggle = page.locator('.navbar-right-content .material-icons').filter({ hasText: /^person$/ });
    this.logoutLink = page.locator('.navbar-right-content a[href="/users/logout"]');
  }

  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/users\/login/);
    await expect(this.welcomeBanner).toBeVisible();
    await expect(this.userMenuToggle).toBeVisible();
  }

  /** Sidebar → Main Menu: the top-level sections shown on screen. */
  async mainMenuSections(): Promise<string[]> {
    const mainMenu = this.page.locator('#sidebar .main-menu-text');
    const sections = this.page.locator('#sidebar #main-navs > li.sidebar-item > a');
    // A click right after page load is ignored until the sidebar script is ready, so retry.
    await expect(async () => {
      if (await mainMenu.isVisible()) await mainMenu.click();
      await expect(sections.first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    return sections.evaluateAll((links) =>
      links.filter((a) => (a as HTMLElement).offsetParent !== null).map((a) => a.childNodes[0].textContent!.trim()),
    );
  }

  /**
   * Every section with its sub-items, from the menu the app renders for the logged-in role.
   * (On screen, opening a section loads one of its pages, so reading them all that way would be slow.)
   */
  async sidebarTree(): Promise<Record<string, string[]>> {
    return this.page.locator('#sidebar #main-navs > li.sidebar-item').evaluateAll((items) =>
      Object.fromEntries(
        items.map((li) => [
          li.querySelector(':scope > a')!.childNodes[0].textContent!.trim(),
          [...li.querySelectorAll(':scope > ul.datas > li > a')].map((a) => a.textContent!.trim()),
        ]),
      ),
    );
  }

  /** Options in the user menu (person icon), read while it is open. */
  async userMenuItems(): Promise<string[]> {
    await this.userMenuToggle.click();
    const items = this.page
      .locator('.navbar-right-content .dropdown-menu')
      .filter({ has: this.page.locator('a[href="/users/logout"]') })
      .locator('a');
    await expect(items.last()).toBeVisible();
    const texts = (await items.allInnerTexts()).map((t) => t.trim());
    await this.userMenuToggle.click(); // close it again
    return texts;
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
