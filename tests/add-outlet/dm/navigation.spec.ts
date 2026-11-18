import { test, expect } from '../../../fixtures/auth.fixture';
import { spec as specFor } from '../../../fixtures/spec';
import { organisationMenu, outletNavigation } from '../../../data/addOutlet';
import { OrganisationPage } from '../../../pages/OrganisationPage';
import { OutletAddPage } from '../../../pages/OutletAddPage';
import { OutletEditPage } from '../../../pages/OutletEditPage';
import { OutletViewPage } from '../../../pages/OutletViewPage';

// Spec: specs/add-outlet/dm/navigation.md. Organisation path and outlet: data/addOutlet.ts (distributorManager).
// These tests only open pages; nothing is submitted.
const spec = (...ids: string[]) => specFor('add-outlet/dm/navigation', ...ids);
const { path, outlet, editKnownIssue } = outletNavigation.distributorManager;

test.describe('Add outlet (distributor manager): open Add / Edit Outlet', () => {
  test.use({ role: 'distributorManager' });

  test('DONAV-01 DM opens Add Outlet by URL', spec('DONAV-01'), async ({ authedPage: page }) => {
    const addPage = new OutletAddPage(page);
    await addPage.goto();

    await expect(addPage.areaSelect).toBeVisible();
    // Filled in by Ajax after the page loads, like the admin's Zone dropdown.
    await expect.poll(() => addPage.options(addPage.areaSelect), { message: "the DM's areas" }).toContain(path.area.name);
    await expect(addPage.zoneSelect).toHaveCount(0);
    await expect(addPage.warehouseSelect).toHaveCount(0);
  });

  test('DONAV-02 DM opens Add Outlet for an area by URL', spec('DONAV-02'), async ({ authedPage: page }) => {
    await new OutletAddPage(page).goto(path.area.id);
  });

  test('DONAV-03 DM opens Add Outlet from the menu', spec('DONAV-03'), async ({ authedPage: page, appShell }) => {
    const organisation = new OrganisationPage(page);
    await appShell.openSidebarItem(organisationMenu.section, organisationMenu.item);
    await organisation.expectLoaded();

    await organisation.expandTo(path);
    const tab = await organisation.openAddOutlet(path.area);

    await new OutletAddPage(tab).expectOpen(path.area.id);
  });

  // Known issue: expected to fail until the DM can edit outlets (or the criterion is changed).
  // When it reports "unexpectedly passed", remove editKnownIssue from data/addOutlet.ts.
  test('DONAV-04 DM opens Edit Outlet by URL', spec('DONAV-04'), async ({ authedPage: page }) => {
    test.fail(!!editKnownIssue, editKnownIssue);
    const editPage = new OutletEditPage(page);
    await editPage.goto(outlet.id);

    await editPage.expectOpenFor(outlet);
  });

  test('DONAV-05 DM opens Edit Outlet from the menu', spec('DONAV-05'), async ({ authedPage: page, appShell }) => {
    const organisation = new OrganisationPage(page);
    await appShell.openSidebarItem(organisationMenu.section, organisationMenu.item);
    await organisation.expectLoaded();

    await organisation.expandTo(path);
    await organisation.showOutlets(path.area);
    await expect(organisation.outletLink(outlet.name)).toBeVisible();

    const tab = await organisation.openOutlet(outlet.name);
    const viewPage = new OutletViewPage(tab);
    await viewPage.expectOpenFor(outlet);

    // Only the Edit step is the known issue: everything up to the outlet view must pass.
    test.fail(!!editKnownIssue, editKnownIssue);
    await expect(viewPage.editLink).toBeVisible({ timeout: 5_000 });
    await viewPage.openEdit();
    await new OutletEditPage(tab).expectOpenFor(outlet);
  });
});
