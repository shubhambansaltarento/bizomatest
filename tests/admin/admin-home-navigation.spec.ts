import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import { spec } from '../../fixtures/spec';
import { roles } from '../../data/roles';
import { UsersListPage } from '../../pages/UsersListPage';
import type { AppShell } from '../../pages/AppShell';

// Spec: specs/admin/admin-home-navigation.md. Sidebar items come from data/roles.ts (admin).
const admin = roles.admin;

test('ADM-01 Admin lands on the users list after login', spec('admin/admin-home-navigation', 'ADM-01'), async ({ authedPage: page, appShell }) => {
  const usersList = new UsersListPage(page);

  await expect(page).toHaveURL(new RegExp(`${admin.landingPath}$`));
  await appShell.expectLoggedInAs(admin.label);
  await usersList.expectLoaded();
  expect((await usersList.readSummary()).total, 'users in the table').toBeGreaterThanOrEqual(1);

  const sidebar = await appShell.currentSidebarSection();
  expect(sidebar.section).toBe('Dashboard');
  expect(sidebar.items).toContain('Users');
});

const redirects: Record<string, string> = admin.sidebarRedirects;
const knownIssues: Record<string, string> = admin.sidebarKnownIssues;

/** Opens one sidebar item and checks that its page loaded properly. */
async function expectItemOpens(
  { page, appShell }: { page: Page; appShell: AppShell },
  section: string,
  item: string,
) {
  const href = await appShell.openSidebarItem(section, item);
  const expectedPath = redirects[item] ?? href;
  test.info().annotations.push({ type: 'page', description: `${section} → ${item}: ${expectedPath}` });

  await expect.soft(page, `${item} should open ${expectedPath}`).toHaveURL((url) => url.pathname === expectedPath);
  await appShell.expectLoggedIn();
  await expect.soft(page.locator('body'), `${item} should load without errors`).not.toContainText(appShell.errorText);
  // After a redirect the URL isn't in the menu, so the sidebar shows no section (see the spec).
  if (!redirects[item]) {
    expect.soft((await appShell.currentSidebarSection()).section, 'sidebar section').toBe(section);
  }
}

// One test per section, so a broken page is reported under its section.
for (const [section, allItems] of Object.entries(admin.sidebar)) {
  const items = allItems.filter((item) => !knownIssues[item]);
  if (!items.length) continue;

  test(
    `ADM-02 Every sidebar item opens its page: ${section}`,
    spec('admin/admin-home-navigation', 'ADM-02'),
    async ({ authedPage: page, appShell }) => {
      // Some pages are slow on the dev server; Products has 12 items.
      test.setTimeout(items.length * 30_000 + 60_000);
      for (const item of items) {
        await test.step(`${section} → ${item}`, () => expectItemOpens({ page, appShell }, section, item));
      }
    },
  );

  // Known issues: expected to fail until fixed. When the app is fixed this reports
  // "unexpectedly passed"; then remove the item from sidebarKnownIssues in data/roles.ts.
  for (const item of allItems.filter((item) => knownIssues[item])) {
    test(
      `ADM-02 Sidebar item opens its page: ${section} → ${item} [known issue]`,
      spec('admin/admin-home-navigation', 'ADM-02'),
      async ({ authedPage: page, appShell }) => {
        test.fail(true, knownIssues[item]);
        try {
          await expectItemOpens({ page, appShell }, section, item);
        } finally {
          // A broken page may have no navbar to log out from; log out from a working page.
          await page.goto(admin.landingPath);
        }
      },
    );
  }
}
