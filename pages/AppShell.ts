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

  /** The section the sidebar is showing (its heading) and that section's items. */
  async currentSidebarSection(): Promise<{ section: string; items: string[] }> {
    const panel = this.page.locator('#sidebar #dataToAttach');
    await expect(panel.locator('h6.current-active-parent')).toBeVisible();
    return {
      // textContent, not innerText: CSS shows the heading in capitals ("DASHBOARD").
      section: (await panel.locator('h6.current-active-parent').textContent())!.trim(),
      items: (await panel.locator('li.sidebar-item > a').allInnerTexts()).map((t) => t.trim()),
    };
  }

  /** Text that means the page failed to load (CakePHP errors, access denied). */
  readonly errorText = /Missing Controller|Missing Method|Fatal error|Internal Server Error|Page Not Found|Invalid Access|Unauthori[sz]ed access/i;

  /**
   * Opens a page from the sidebar the way a user does: Main Menu → section → item. Returns the
   * item's link target (e.g. '/skunits/add') so the caller can check where it landed (the app may
   * redirect elsewhere).
   *
   * The sidebar shows one section's items at a time (`#dataToAttach`, headed by the section name).
   * Clicking a section in Main Menu opens that section's first page and then shows its items.
   */
  async openSidebarItem(section: string, item: string): Promise<string> {
    const panel = this.page.locator('#sidebar #dataToAttach');
    const panelTitle = panel.locator('h6.current-active-parent');
    // Some pages show no section at all (e.g. after a redirect), so don't wait for the heading.
    const shown = (await panelTitle.count()) ? (await panelTitle.textContent())?.trim() : undefined;
    if (shown !== section) {
      await this.mainMenuSections(); // opens Main Menu
      await this.page.locator('#sidebar #main-navs > li.sidebar-item > a').and(this.page.locator(`[title="${section}"]`)).click();
      await this.page.waitForLoadState('domcontentloaded');
      await expect(panelTitle).toHaveText(section, { timeout: 30_000 });
    }
    const link = panel.locator('li.sidebar-item > a').and(this.page.locator(`[title="${item}"]`));
    const href = (await link.getAttribute('href'))!;
    await Promise.all([
      this.page.waitForEvent('framenavigated', { predicate: (f) => f === this.page.mainFrame(), timeout: 30_000 }),
      link.click(),
    ]);
    await this.page.waitForLoadState('load');
    return href;
  }

  /**
   * User menu → Change Password: the logged-in user changes their own password. Waits for the
   * app's "Successfully changed password" Alert and closes it.
   */
  async changeOwnPassword(oldPassword: string, newPassword: string) {
    // :visible because each click adds another copy of the dialog to the page.
    const dialog = this.page.locator('.ui-dialog:visible').filter({ hasText: 'Password Change' });
    // The menu item is a plain link (/users/changepwddialog) that page scripts turn into a dialog
    // once they are ready; clicked too early it opens as a bare page. Go back and try again then.
    // The dialog's content is loaded from the server, so give it time before clicking again.
    await expect(async () => {
      if (this.page.url().includes('/users/changepwddialog')) await this.page.goBack();
      if (!(await dialog.count())) {
        await this.userMenuToggle.click();
        await this.page.locator('#changeownpwd').click();
      }
      await expect(dialog).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
    await dialog.locator('#oldpwd').fill(oldPassword);
    await dialog.locator('#changepwd').fill(newPassword);
    await dialog.locator('#changepwdcnf').fill(newPassword);
    await dialog.getByRole('button', { name: 'Change Password' }).click();

    const alert = this.page.locator('.ui-dialog').filter({ has: this.page.locator('.ui-dialog-title', { hasText: /^Alert$/ }) });
    await expect(alert).toContainText('Successfully changed password');
    await alert.getByRole('button', { name: 'Ok' }).click();
    await expect(alert).toBeHidden();
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
