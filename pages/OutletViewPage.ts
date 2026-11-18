import { expect, type Locator, type Page } from '@playwright/test';

/** Outlet view at /outlets/view/<id>, opened in a new tab from an area's outlet list in Organisation. */
export class OutletViewPage {
  /** Pencil icon next to the name (an image with alt "Edit Outlet"). Not shown to roles that can't edit. */
  readonly editLink: Locator;
  /** Flash message after /outlets/edit/<id> is refused. */
  readonly noEditPermissionMessage: Locator;

  constructor(private readonly page: Page) {
    this.editLink = page.getByRole('link', { name: 'Edit Outlet', exact: true });
    this.noEditPermissionMessage = page.getByText('You do not have sufficient permission to edit an OUTLET.');
  }

  static path(id: number) {
    return `/outlets/view/${id}`;
  }

  async expectOpenFor(outlet: { id: number; name: string }) {
    await expect(this.page).toHaveURL((url) => url.pathname === OutletViewPage.path(outlet.id));
    // The heading also holds a status icon's name (e.g. "check_circle_outline"), so not exact.
    await expect(this.page.getByRole('heading', { name: outlet.name }).first()).toBeVisible();
  }

  /** Clicks the pencil icon; the Edit page opens in the same tab. */
  async openEdit() {
    await this.editLink.click();
    await this.page.waitForLoadState();
  }
}
