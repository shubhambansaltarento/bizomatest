import { expect, type Locator, type Page } from '@playwright/test';
import type { OrgAreaPath } from '../data/addOutlet';

/**
 * Dashboard → Organisation (/companies/dashboard): the company tree
 * company → zone → subzone → warehouse / distributor → area.
 *
 * Each level is an accordion header (h3) holding a link with the name; its content is loaded by
 * Ajax when the header is clicked. Clicking an open header closes it again.
 * An area row has the area name (click: lists its outlets on the right) and an action dropdown
 * (Add OUTLET / Edit Area / Download OUTLET) with a Go button, which opens the page in a new tab.
 */
export class OrganisationPage {
  static readonly path = '/companies/dashboard';

  /** Right-hand panel before an area is picked. */
  readonly pickAreaHint: Locator;
  /** Outlets of the clicked area (DataTable on the right). */
  readonly outletsTable: Locator;

  constructor(private readonly page: Page) {
    this.pickAreaHint = page.getByText('Please Click on Area to load Outlet.');
    this.outletsTable = page.locator('table#tableoutlets');
  }

  async goto() {
    await this.page.goto(OrganisationPage.path);
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL((url) => url.pathname === OrganisationPage.path);
    await expect(this.pickAreaHint).toBeVisible();
  }

  /** Accordion header (zone, subzone or warehouse) with exactly this name. */
  header(name: string): Locator {
    // Two zones can share a name (devarun has two "Pricing Zone"): take the first.
    return this.page
      .locator('h3:visible')
      .filter({ has: this.page.getByRole('link', { name, exact: true }) })
      .first();
  }

  areaLink(area: OrgAreaPath['area']): Locator {
    return this.page.locator(`a#areaid${area.id}`);
  }

  areaActionSelect(area: OrgAreaPath['area']): Locator {
    return this.page.locator(`select#areaselect${area.id}`);
  }

  areaGoButton(area: OrgAreaPath['area']): Locator {
    return this.page
      .locator('td')
      .filter({ has: this.areaActionSelect(area) })
      .getByRole('button', { name: 'Go', exact: true });
  }

  outletLink(name: string): Locator {
    return this.outletsTable.getByRole('link', { name, exact: true });
  }

  /** Expands zone → subzone → warehouse until the area's row is shown. */
  async expandTo(path: OrgAreaPath) {
    const levels = [path.zone, path.subzone, path.warehouse].filter((name): name is string => !!name);
    for (const [i, name] of levels.entries()) {
      // Each level's content arrives by Ajax: wait for the next header (or the area) to show.
      const next = i + 1 < levels.length ? this.header(levels[i + 1]) : this.areaLink(path.area);
      await this.header(name).click();
      await expect(next, `${levels.slice(0, i + 1).join(' → ')} should show ${levels[i + 1] ?? path.area.name}`).toBeVisible({
        timeout: 30_000,
      });
    }
    await expect(this.areaLink(path.area)).toContainText(path.area.name);
  }

  /** Area row → Add OUTLET → Go. Returns the new tab it opens. */
  async openAddOutlet(area: OrgAreaPath['area']): Promise<Page> {
    await this.areaActionSelect(area).selectOption('addoutlet');
    const [tab] = await Promise.all([this.page.context().waitForEvent('page'), this.areaGoButton(area).click()]);
    await tab.waitForLoadState();
    return tab;
  }

  /** Clicks the area's name and waits for its outlets to be listed. */
  async showOutlets(area: OrgAreaPath['area']) {
    await this.areaLink(area).click();
    await expect(this.outletsTable).toBeVisible({ timeout: 30_000 });
  }

  /** Clicks an outlet in the area's list, which opens its view page in a new tab. Returns that tab. */
  async openOutlet(name: string): Promise<Page> {
    const [tab] = await Promise.all([this.page.context().waitForEvent('page'), this.outletLink(name).click()]);
    await tab.waitForLoadState();
    return tab;
  }
}
