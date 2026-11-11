import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { automationUsers, freshPassword } from '../../data/automationUsers';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';
import { UserDetailsPage } from '../../pages/UserDetailsPage';

// Spec: specs/users/user-lifecycle.md. Users: data/automationUsers.ts (automation accounts, "e2e.*").
const spec = (...ids: string[]) => specFor('users/user-lifecycle', ...ids);

for (const user of automationUsers) {
  test.describe(`Automation user ${user.username} (${user.role})`, () => {
    // Password first, then active status: in order, in one worker, and the second runs even if the first fails.
    test.describe.configure({ mode: 'default' });

    test(
      `ULIFE-01..04 ${user.role} logs in and changes their password`,
      spec('ULIFE-01', 'ULIFE-02', 'ULIFE-03', 'ULIFE-04'),
      async ({ authedPage, loginAs }) => {
        // Up to four logins on a slow dev server.
        test.setTimeout(180_000);
        const { webLogin } = user;
        if (webLogin.result === 'knownIssue') test.fail(true, webLogin.issue);
        const editPage = new UserEditPage(authedPage);
        // New passwords every run: the app refuses any of a user's last 3 passwords.
        const password = freshPassword();
        const newPassword = freshPassword();

        await test.step('ULIFE-01 Admin sets the user\'s password', async () => {
          await editPage.goto(user.id);
          await editPage.expectLoadedFor(user);
          // A run that stopped half-way can leave the user inactive.
          if (!(await editPage.activeCheckbox.isChecked())) {
            await editPage.saveActive(true);
            await editPage.goto(user.id);
          }
          await editPage.openChangePassword();
          await editPage.changePassword(password);
        });

        if (webLogin.result === 'refused') {
          await test.step(`ULIFE-02 Web login is refused: "${webLogin.message}"`, async () => {
            test.info().annotations.push({ type: 'web login refused', description: webLogin.note });
            const { loginPage, appShell } = await loginAs(user.username, password);
            await loginPage.expectVisible();
            await expect(loginPage.message(webLogin.message)).toBeVisible();
            await expect(appShell.userMenuToggle).toHaveCount(0);
          });
          test.info().annotations.push({ type: 'not run', description: 'ULIFE-03/04: the user can\'t log in to the web app' });
          return;
        }

        // Each login uses its own browser (closed after the test), so there is no logout here: some
        // landing pages keep polling the server, which makes logout's wait for a quiet page time out.
        await test.step('ULIFE-02 The user can log in', async () => {
          const { appShell } = await loginAs(user.username, password);
          await appShell.expectLoggedIn();

          await test.step('ULIFE-03 The user can change their own password', async () => {
            await appShell.changeOwnPassword(password, newPassword);
          });
        });

        await test.step('ULIFE-04 The old password no longer works', async () => {
          const { loginPage, appShell } = await loginAs(user.username, password);
          await loginPage.expectVisible();
          await expect(appShell.userMenuToggle).toHaveCount(0);
        });

        await test.step('ULIFE-04 The new password works', async () => {
          const { appShell } = await loginAs(user.username, newPassword);
          await appShell.expectLoggedIn();
        });
      },
    );

    test(
      `ULIFE-05..06 ${user.role} is deactivated and reactivated`,
      spec('ULIFE-05', 'ULIFE-06'),
      async ({ authedPage }) => {
        const editPage = new UserEditPage(authedPage);
        const usersList = new UsersListPage(authedPage);
        const statusOf = async () => {
          const rows = (await usersList.visibleUsers()).filter((u) => u.username === user.username);
          return Promise.all(rows.map((u) => u.row.locator('td').nth(UsersListPage.columns.indexOf('Status')).innerText()));
        };

        await test.step('ULIFE-05 Admin marks the user inactive', async () => {
          await editPage.goto(user.id);
          await editPage.expectLoadedFor(user);
          await editPage.saveActive(false);
          await expect(usersList.flashMessage).toContainText('The user has been saved');
          await usersList.expectLoaded();

          await usersList.search(user.username);
          expect(await statusOf(), 'rows under Active Users').toEqual([]);
          await usersList.showStatus('inactive');
          expect(await statusOf(), 'rows under Inactive Users').toEqual(['Inactive']);
        });

        await test.step('ULIFE-06 Admin reactivates the user from the Inactive list', async () => {
          // Still on Inactive Users, filtered to this user.
          await usersList.openDetails(user.username);
          const details = new UserDetailsPage(authedPage);
          await details.expectLoadedFor(user);
          // Edit opens in a new tab; reactivate there, then check the list in the first tab.
          const editTab = await details.openEditInNewTab();
          const tabEditPage = new UserEditPage(editTab);
          await tabEditPage.expectLoadedFor(user);
          await expect(tabEditPage.activeCheckbox).not.toBeChecked();
          await tabEditPage.saveActive(true);
          await expect(new UsersListPage(editTab).flashMessage).toContainText('The user has been saved');
          await editTab.close();

          await usersList.goto();
          await usersList.search(user.username);
          expect(await statusOf(), 'rows under Active Users').toEqual(['Active']);
        });
      },
    );
  });
}
