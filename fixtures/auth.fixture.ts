import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AppShell } from '../pages/AppShell';
import { roles, type RoleName } from '../data/roles';

type AuthOptions = {
  /** Role `authedPage` logs in as. Defaults to admin; change with `test.use({ role: 'distributorManager' })`. */
  role: RoleName;
};

type AuthFixtures = {
  loginPage: LoginPage;
  appShell: AppShell;
  /**
   * A page that is already logged in as `role`. Logs out automatically after the test.
   * Every module spec should use this instead of `page`.
   */
  authedPage: Page;
};

export const test = base.extend<AuthOptions & AuthFixtures>({
  role: ['admin', { option: true }],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },

  authedPage: async ({ page, loginPage, appShell, role }, use) => {
    const { username, password } = roles[role].credentials();
    await loginPage.goto();
    await loginPage.login(username, password);
    await appShell.expectLoggedIn();

    await use(page);

    await appShell.logout();
    await loginPage.expectVisible();
  },
});

export { expect };
