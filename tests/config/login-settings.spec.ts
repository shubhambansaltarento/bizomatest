import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/settings.fixture';
import { spec as specFor } from '../../fixtures/spec';
import type { TestUser } from '../../fixtures/testUsers';
import { freshPassword } from '../../data/automationUsers';
import { UserEditPage } from '../../pages/UserEditPage';

// Spec: specs/config/login-settings.md. Runs only with `npm run test:config` (changes app settings).
const spec = (...ids: string[]) => specFor('config/login-settings', ...ids);

const lockMessage = 'Password was changed in the last 24 hours. Please wait 24 hours to change the password again';
const notOnWeb = (seen: string) =>
  `Not on the web (${seen}); the sheet case is for the app. Awaiting product: app-only, or a web bug?`;

/** Role of the users these tests create: logs in to the web, needs no mapping. */
const role = 'REPORT ADMIN';

/** Admin sets a new password for the user on their Edit page; returns it. */
async function adminSetsPassword(page: Page, user: TestUser) {
  const password = freshPassword();
  const editPage = new UserEditPage(page);
  await editPage.goto(user.id);
  await editPage.openChangePassword();
  await editPage.changePassword(password);
  user.password = password;
  return password;
}

test.describe('Login settings', () => {
  // Several logins and settings changes on a slow dev server.
  test.describe.configure({ timeout: 10 * 60_000 });

  test(
    'LCFG-01..03 With the 24-hour lock, nobody can change the password again',
    spec('LCFG-01', 'LCFG-02', 'LCFG-03'),
    async ({ authedPage, loginAs, appSettings, newTestUser }) => {
      const user = await newTestUser({ role });
      // Changed while the lock is still off, so the change itself isn't blocked.
      await adminSetsPassword(authedPage, user);
      await appSettings.setForCompany('passwordresetlock', '1');

      await test.step('LCFG-01 The user can\'t change their own password', async () => {
        const { appShell } = await loginAs(user.username, user.password);
        await appShell.expectLoggedIn();
        await appShell.changeOwnPasswordRefused();
        await expect(appShell.warningMessage).toContainText(lockMessage);

        await test.step('LCFG-03 The message says 24 hours, not 6', async () => {
          await expect(appShell.warningMessage).toContainText('24 hours');
          await expect(appShell.warningMessage).not.toContainText(/\b6 hours?\b/);
        });
      });

      await test.step('LCFG-02 The admin can\'t change it either', async () => {
        const editPage = new UserEditPage(authedPage);
        await editPage.goto(user.id);
        const banner = await editPage.openChangePasswordRefused();
        await expect(banner).toContainText(lockMessage);
        await expect(banner).not.toContainText(/\b6 hours?\b/);
      });
    },
  );

  test(
    'LCFG-04 Changing a user\'s password logs them out',
    spec('LCFG-04'),
    async ({ authedPage, loginAs, appSettings, newTestUser }) => {
      test.fail(true, notOnWeb('12 Nov 2026: the user stays logged in'));
      const user = await newTestUser({ role });
      await appSettings.setForCompany('forceLogoutOnPasswordChange', '1');
      const { page, loginPage, appShell } = await loginAs(user.username, user.password);
      await appShell.expectLoggedIn();

      await adminSetsPassword(authedPage, user);

      await page.reload();
      await loginPage.expectVisible();
      await expect(appShell.userMenuToggle).toHaveCount(0);
    },
  );

  test(
    'LCFG-05 A new user is asked to reset their password on first login',
    spec('LCFG-05'),
    async ({ authedPage, loginAs, appSettings, newTestUser }) => {
      test.fail(true, notOnWeb('11 Nov 2026: the first login goes straight to the dashboard'));
      const user = await newTestUser({ role });
      await appSettings.setForUser('initialPasswordReset', user, '1');

      const { page, appShell } = await loginAs(user.username, user.password);
      await expect(page).not.toHaveURL(/\/users\/login/);
      await expect(appShell.newPasswordField.first()).toBeVisible();
    },
  );

  test(
    'LCFG-06 The first reset is not blocked by the 24-hour lock',
    spec('LCFG-06'),
    async ({ authedPage, loginAs, appSettings, newTestUser }) => {
      test.fail(true, notOnWeb('11 Nov 2026: no first-login reset on the web (LCFG-05)'));
      const user = await newTestUser({ role });
      await appSettings.setForUser('initialPasswordReset', user, '1');
      await appSettings.setForCompany('passwordresetlock', '1');

      const { page, appShell } = await loginAs(user.username, user.password);
      await expect(page).not.toHaveURL(/\/users\/login/);
      await expect(appShell.newPasswordField.first()).toBeVisible();
      await expect(appShell.warningMessage).toHaveCount(0);
    },
  );

  for (const { id, days, row } of [
    { id: 'LCFG-07', days: 1, row: 30 },
    { id: 'LCFG-08', days: 3, row: 32 },
  ]) {
    const message = `Password reset is due in ${days} ${days === 1 ? 'day' : 'days'}!`;
    test(`${id} Alert ${days} day(s) before the password expires`, spec(id), async ({ authedPage, loginAs, appSettings, newTestUser }) => {
      test.fail(true, notOnWeb('12 Nov 2026: no alert, in the page or as a browser pop-up'));
      test.info().annotations.push({ type: 'sheet row', description: String(row) });
      const user = await newTestUser({ role });
      await appSettings.setForUser('password_ageing_days', user, String(days));
      await appSettings.setForCompany('changepasswordnotification', '{"enable": 1,"alert_days": [3,1]}');
      // Set now, so it expires in exactly `days` days.
      await adminSetsPassword(authedPage, user);

      const { loginPage, appShell, nativeDialogs } = await loginAs(user.username, user.password);
      await appShell.expectLoggedIn();
      await expect
        .poll(async () => nativeDialogs.includes(message) || (await loginPage.message(message).isVisible()), {
          message: `"${message}" shown in the page or as a browser alert`,
          timeout: 15_000,
        })
        .toBe(true);
    });
  }
});
