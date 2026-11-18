import { expect, type Locator, type Page } from '@playwright/test';

/** Edit Outlet at /outlets/edit/<id>, opened from the outlet view's pencil icon (Edit Outlet). */
export class OutletEditPage {
  readonly heading: Locator;
  readonly nameInput: Locator;

  constructor(private readonly page: Page) {
    // Not a heading role: the form's sections are jQuery UI accordion headers (role "tab").
    this.heading = page.getByText('OUTLET Details', { exact: true }).first();
    this.nameInput = page.locator('#OutletName');
  }

  static path(id: number) {
    return `/outlets/edit/${id}`;
  }

  /** Opens the URL only; a role without permission is sent back to the outlet view (no check here). */
  async goto(id: number) {
    await this.page.goto(OutletEditPage.path(id));
  }

  async expectOpenFor(outlet: { id: number; name: string }) {
    await expect(this.page).toHaveURL((url) => url.pathname === OutletEditPage.path(outlet.id));
    await expect(this.heading).toBeVisible();
    await expect(this.nameInput).toHaveValue(outlet.name);
  }
}
