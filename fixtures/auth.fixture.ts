import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AppShell } from '../pages/AppShell';

type AuthFixtures = {
  loginPage: LoginPage;
  appShell: AppShell;
  /**
   * A page that is already logged in. Logs out automatically after the test.
   * Every module spec should use this instead of `page`.
   */
  authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },

  authedPage: async ({ page, loginPage, appShell }, use) => {
    await loginPage.goto();
    await loginPage.login();
    await appShell.expectLoggedIn();

    await use(page);

    await appShell.logout();
    await loginPage.expectVisible();
  },
});

export { expect };
