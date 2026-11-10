import { test, expect } from '../../fixtures/auth.fixture';
import { spec } from '../../fixtures/spec';
import { roles, type RoleName } from '../../data/roles';

// Spec: specs/roles/role-based-ui.md. Expected UI per role: data/roles.ts.
// The same tests run for every role in the config; add a role there and it is tested here.
for (const roleName of Object.keys(roles) as RoleName[]) {
  const role = roles[roleName];

  test.describe(`Role: ${role.label}`, () => {
    test.use({ role: roleName });

    test(
      `ROLE-01..04 ${role.label} sees exactly its banner, menus and user options`,
      spec('roles/role-based-ui', 'ROLE-01', 'ROLE-02', 'ROLE-03', 'ROLE-04'),
      async ({ authedPage: page, appShell }) => {
        await test.step('ROLE-01 The user lands in the app as the right role', async () => {
          await expect(page).toHaveURL(new RegExp(`${role.landingPath}$`));
          await appShell.expectLoggedInAs(role.label);
        });

        // Soft assertions: report every difference in one run instead of stopping at the first.
        await test.step("ROLE-02 Main Menu shows exactly the role's sections", async () => {
          expect.soft(await appShell.mainMenuSections(), 'Main Menu sections').toEqual(Object.keys(role.sidebar));
        });

        await test.step("ROLE-03 Each section has exactly the role's items", async () => {
          expect.soft(await appShell.sidebarTree(), 'sections and their items').toEqual(role.sidebar);
        });

        await test.step("ROLE-04 User menu shows exactly the role's options", async () => {
          expect.soft(await appShell.userMenuItems(), 'user menu options').toEqual(role.userMenu);
        });
      },
    );

    const blocked = role.blockedPages.filter((p) => !p.knownIssue);
    if (blocked.length) {
      test(
        `ROLE-05 ${role.label} can't open other roles' pages by URL`,
        spec('roles/role-based-ui', 'ROLE-05'),
        async ({ authedPage: page }) => {
          for (const { path, name } of blocked) {
            await test.step(`${name} (${path})`, async () => {
              await page.goto(path);
              await expect.soft(page, `${name} should be blocked`).toHaveURL(/\/users\/dashboard/);
            });
          }
        },
      );
    }

    // Known issues: expected to fail until fixed. When the app is fixed this reports
    // "unexpectedly passed"; then remove `knownIssue` from data/roles.ts.
    for (const { path, name, knownIssue } of role.blockedPages.filter((p) => p.knownIssue)) {
      test(
        `ROLE-05 ${role.label} can't open ${name} by URL [known issue]`,
        spec('roles/role-based-ui', 'ROLE-05'),
        async ({ authedPage: page }) => {
          test.fail(true, knownIssue);
          await page.goto(path);
          await expect(page).toHaveURL(/\/users\/dashboard/);
        },
      );
    }
  });
}
