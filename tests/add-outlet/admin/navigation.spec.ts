import { test, expect } from '../../../fixtures/auth.fixture';
import { spec as specFor } from '../../../fixtures/spec';
import { organisationMenu, outletNavigation } from '../../../data/addOutlet';
import { OrganisationPage } from '../../../pages/OrganisationPage';
import { OutletAddPage } from '../../../pages/OutletAddPage';
import { OutletEditPage } from '../../../pages/OutletEditPage';
import { OutletViewPage } from '../../../pages/OutletViewPage';

// Spec: specs/add-outlet/admin/navigation.md. Organisation path and outlet: data/addOutlet.ts (admin).
// These tests only open pages; nothing is submitted.
const spec = (...ids: string[]) => specFor('add-outlet/admin/navigation', ...ids);
const { path, outlet } = outletNavigation.admin;

test.describe('Add outlet (admin): open Add / Edit Outlet', () => {
  test('AONAV-01 Admin opens Add Outlet by URL', spec('AONAV-01'), async ({ authedPage: page }) => {
    const addPage = new OutletAddPage(page);
    await addPage.goto();

    await expect(addPage.zoneSelect).toBeVisible();
    await expect(addPage.warehouseSelect).toBeVisible();
    await expect(addPage.areaSelect).toBeVisible();
    // Zones are filled in by Ajax after the page loads.
    await expect.poll(() => addPage.options(addPage.zoneSelect), { message: 'zones to choose from' }).not.toHaveLength(0);
  });

  test('AONAV-02 Admin opens Add Outlet for an area by URL', spec('AONAV-02'), async ({ authedPage: page }) => {
    const addPage = new OutletAddPage(page);
    await addPage.goto(path.area.id);

    await expect(addPage.zoneSelect).toHaveCount(0);
    await expect(addPage.warehouseSelect).toHaveCount(0);
    await expect(addPage.areaSelect).toHaveCount(0);
  });

  test('AONAV-03 Admin opens Add Outlet from the menu', spec('AONAV-03'), async ({ authedPage: page, appShell }) => {
    const organisation = new OrganisationPage(page);
    await appShell.openSidebarItem(organisationMenu.section, organisationMenu.item);
    await organisation.expectLoaded();

    await organisation.expandTo(path);
    const tab = await organisation.openAddOutlet(path.area);

    await new OutletAddPage(tab).expectOpen(path.area.id);
  });

  test('AONAV-04 Admin opens Edit Outlet by URL', spec('AONAV-04'), async ({ authedPage: page }) => {
    const editPage = new OutletEditPage(page);
    await editPage.goto(outlet.id);

    await editPage.expectOpenFor(outlet);
  });

  test('AONAV-05 Admin opens Edit Outlet from the menu', spec('AONAV-05'), async ({ authedPage: page, appShell }) => {
    const organisation = new OrganisationPage(page);
    await appShell.openSidebarItem(organisationMenu.section, organisationMenu.item);
    await organisation.expectLoaded();

    await organisation.expandTo(path);
    await organisation.showOutlets(path.area);
    await expect(organisation.outletLink(outlet.name)).toBeVisible();

    const tab = await organisation.openOutlet(outlet.name);
    const viewPage = new OutletViewPage(tab);
    await viewPage.expectOpenFor(outlet);

    await viewPage.openEdit();
    await new OutletEditPage(tab).expectOpenFor(outlet);
  });
});
