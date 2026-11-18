import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Add Outlet: /outlets/add, or /outlets/add/<areaId> for one area (what Organisation → area →
 * Add OUTLET → Go opens). With an area in the URL the Zone / Warehouse / Area dropdowns are not shown.
 * A distributor manager gets no Zone / Warehouse dropdowns either, only Select Area with their areas.
 */
export class OutletAddPage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly zoneSelect: Locator;
  readonly warehouseSelect: Locator;
  /** "Select Area". Filled once a warehouse is chosen (admin) or straight away (DM). */
  readonly areaSelect: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Add OUTLET', exact: true });
    this.nameInput = page.locator('#OutletName');
    this.zoneSelect = page.locator('select#OutletZoneId');
    this.warehouseSelect = page.locator('select#OutletWarehouseId');
    this.areaSelect = page.locator('select#OutletAreaId');
    this.submitButton = page.locator('#outletsubmit');
  }

  static path(areaId?: number) {
    return areaId === undefined ? '/outlets/add' : `/outlets/add/${areaId}`;
  }

  async goto(areaId?: number) {
    await this.page.goto(OutletAddPage.path(areaId));
    await this.expectOpen(areaId);
  }

  /** The Add Outlet form is shown, on /outlets/add or /outlets/add/<areaId>. */
  async expectOpen(areaId?: number) {
    await expect(this.page).toHaveURL((url) => url.pathname === OutletAddPage.path(areaId));
    await expect(this.heading).toBeVisible();
    await expect(this.nameInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /** Option texts of a dropdown, without the "Please select" placeholder. */
  async options(select: Locator): Promise<string[]> {
    const texts = (await select.locator('option').allTextContents()).map((t) => t.trim());
    return texts.filter((t) => t && !/^please select/i.test(t));
  }
}
