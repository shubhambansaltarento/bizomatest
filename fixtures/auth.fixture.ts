import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
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
  /**
   * Opens a separate browser (own cookies) and submits the login form there, e.g. for a user the
   * admin just created, while `authedPage` stays logged in as admin. Does not check the outcome:
   * use the returned `appShell.expectLoggedIn()` or `loginPage.expectVisible()`.
   * Browsers opened this way are closed after the test.
   * `nativeDialogs` collects the text of browser alerts/confirms shown from the start (they are
   * dismissed, as Playwright does by default).
   */
  loginAs: (
    username: string,
    password: string,
  ) => Promise<{ page: Page; loginPage: LoginPage; appShell: AppShell; nativeDialogs: string[] }>;
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

  loginAs: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (username, password) => {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const page = await context.newPage();
      const nativeDialogs: string[] = [];
      page.on('dialog', (d) => {
        nativeDialogs.push(d.message());
        d.dismiss().catch(() => {});
      });
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(username, password);
      return { page, loginPage, appShell: new AppShell(page), nativeDialogs };
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };
