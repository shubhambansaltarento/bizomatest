import type { BrowserContext } from '@playwright/test';
import { test as base, expect } from './auth.fixture';
import { roles } from '../data/roles';
import { appSettings, type SettingName } from '../data/settings';
import { LoginPage } from '../pages/LoginPage';
import { AppShell } from '../pages/AppShell';
import { SettingsPage } from '../pages/SettingsPage';

type UserRef = { role: string; username: string };

export type AppSettings = {
  /** Current company-wide value (Default Settings). */
  companyValue(name: SettingName): Promise<string>;
  /** Sets a setting for the whole company; restored after the test. */
  setForCompany(name: SettingName, value: string): Promise<void>;
  /** Sets a setting for one user only (settings with level 'user'); restored after the test. */
  setForUser(name: SettingName, user: UserRef, value: string): Promise<void>;
  /**
   * Puts back everything changed so far, now instead of after the test. Call it before deactivating
   * a user whose settings were changed: inactive users aren't listed on the settings page.
   */
  restoreNow(): Promise<void>;
};

/**
 * `appSettings`: changes app settings for one test, the way an admin does it, and puts the original
 * values back afterwards (also when the test fails). See data/settings.ts.
 *
 * Settings → All Settings (`/settings/allsettings`) is admin-only, so this opens its own browser
 * logged in as ADMIN, whatever role the test itself uses.
 */
export const test = base.extend<{ appSettings: AppSettings }>({
  // Own time budget (not the test's), so values are put back even after a test times out.
  appSettings: [async ({ browser, baseURL }, use, testInfo) => {
    let context: BrowserContext | undefined;
    let settingsPage: SettingsPage | undefined;
    const restore: Array<() => Promise<void>> = [];

    const asAdmin = async () => {
      if (!settingsPage) {
        context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        const { username, password } = roles.admin.credentials();
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login(username, password);
        await new AppShell(page).expectLoggedIn();
        settingsPage = new SettingsPage(page);
      }
      return settingsPage;
    };
    const note = (text: string) => testInfo.annotations.push({ type: 'setting', description: text });

    // Undo in reverse order; try every one even if one fails, then report the failures.
    const restoreAll = async () => {
      const errors: unknown[] = [];
      for (const undo of restore.splice(0).reverse()) {
        await undo().catch((e) => errors.push(e));
      }
      if (errors.length) throw new Error(`Could not restore ${errors.length} setting(s): ${errors.map(String).join('; ')}`);
    };

    await use({
      restoreNow: restoreAll,

      async companyValue(name) {
        const settings = await asAdmin();
        await settings.goto();
        return settings.companyValue(name);
      },

      async setForCompany(name, value) {
        const settings = await asAdmin();
        await settings.goto();
        const original = await settings.companyValue(name);
        if (original === value) return;
        restore.push(async () => {
          await settings.goto();
          await settings.setCompanyValue(name, original);
          note(`${name} restored to ${original}`);
        });
        await settings.setCompanyValue(name, value);
        await settings.goto();
        expect(await settings.companyValue(name), `company value of ${name} after saving`).toBe(value);
        note(`${name} = ${value} (company, was ${original})`);
      },

      async setForUser(name, user, value) {
        if (appSettings[name].level !== 'user') throw new Error(`${name} can only be set for the whole company`);
        const settings = await asAdmin();
        const original = await settings.userValue(user.role, user.username, name);
        if (original === value) return;
        restore.push(async () => {
          await settings.setUserValue(user.role, user.username, name, original);
          note(`${name} restored to ${original} for ${user.username}`);
        });
        await settings.setUserValue(user.role, user.username, name, value);
        expect(await settings.userValue(user.role, user.username, name), `${name} for ${user.username} after saving`).toBe(value);
        note(`${name} = ${value} for ${user.username} (was ${original})`);
      },
    });

    try {
      await restoreAll();
    } finally {
      await context?.close();
    }
  }, { timeout: 5 * 60_000 }],
});

export { expect };
