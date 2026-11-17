import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { automationUsers } from '../../data/automationUsers';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserDetailsPage } from '../../pages/UserDetailsPage';

// Spec: specs/users/user-details.md. UVIEW-01/02 only read pages; UVIEW-03/04 create a user (`newTestUser` deactivates it).
const spec = (...ids: string[]) => specFor('users/user-details', ...ids);

const reportAdmin = automationUsers.find((u) => u.role === 'REPORT ADMIN')!;
const salesManager = automationUsers.find((u) => u.role === 'SALES MANAGER')!;

/** Today as the details page writes dates: yyyy-mm-dd (local time, as the server's). */
function today() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
}

test.describe('User details page', () => {
  test('UVIEW-01 Clicking a username opens the user\'s details', spec('UVIEW-01'), async ({ authedPage }) => {
    const usersList = new UsersListPage(authedPage);
    const details = new UserDetailsPage(authedPage);
    await usersList.goto();
    await usersList.search(reportAdmin.username);
    await usersList.openDetails(reportAdmin.username);
    await details.expectLoadedFor(reportAdmin);
    await expect(details.field('Username')).toHaveText(reportAdmin.username);
    await expect(details.field('Name')).toHaveText(reportAdmin.name);
    await expect(details.field('Role')).toHaveText(reportAdmin.role);
  });

  test('UVIEW-02 The details page loads without server errors', spec('UVIEW-02'), async ({ authedPage, serverErrors }) => {
    const details = new UserDetailsPage(authedPage);

    for (const user of [reportAdmin, salesManager]) {
      await test.step(`${user.username}: open, reload twice, Home`, async () => {
        await details.goto(user.id);
        await expect(details.field('Username')).toHaveText(user.username);
        for (let i = 0; i < 2; i++) {
          await authedPage.reload();
          await expect(details.field('Username')).toHaveText(user.username);
        }
        await details.homeLink.click();
        await details.expectLoadedFor(user);
        await expect(details.field('Username')).toHaveText(user.username);
      });
    }
    serverErrors.expectNone();
  });

  test(
    'UVIEW-03 Last login time is updated after a web login; UVIEW-04 last logout time after a web logout',
    spec('UVIEW-03', 'UVIEW-04'),
    async ({ authedPage, loginAs, newTestUser }) => {
      test.fail(
        true,
        'devarun (17 Nov 2026): Login / Logout Details are no longer updated (empty for today\'s logins; the main admin\'s still show 2026-08-28). Sheet precondition: "Custom branch should be available".',
      );
      const details = new UserDetailsPage(authedPage);
      const user = await newTestUser({ role: 'REPORT ADMIN' });
      const { appShell, loginPage } = await loginAs(user.username, user.password);

      await test.step('UVIEW-03 After the web login, Login Details shows today', async () => {
        await appShell.expectLoggedIn();
        await details.goto(user.id);
        await expect(details.loginDetails).toHaveText(new RegExp(`Last Login Date Time : ${today()} \\d{2}:\\d{2}`));
        await expect(details.loginVersion).toHaveCount(0);
      });

      await test.step('UVIEW-04 After the web logout, Logout Details shows today', async () => {
        await appShell.logout();
        await loginPage.expectVisible();
        await details.goto(user.id);
        await expect(details.logoutDetails).toHaveText(new RegExp(`Last Logout Time : ${today()} \\d{2}:\\d{2}`));
        await expect(details.loginDetails).toContainText(today());
      });
    },
  );
});
