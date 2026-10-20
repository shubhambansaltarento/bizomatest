import { test, expect } from '../../fixtures/auth.fixture';
import { spec } from '../../fixtures/spec';
import { env } from '../../config/env';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';

// Spec: specs/users/user-change-password.md
// One journey: each criterion builds on the previous one, so they run as steps of one test.
test(
  'USR-01..04 Users list → 10 per page → edit random user → open Change Password',
  spec('users/user-change-password', 'USR-01', 'USR-02', 'USR-03', 'USR-04'),
  async ({ authedPage }) => {
    const usersList = new UsersListPage(authedPage);
    const editPage = new UserEditPage(authedPage);

    const total = await test.step('USR-01 Users list shows 25 entries per page by default', async () => {
      await usersList.goto();
      const { total } = await usersList.readSummary();
      await usersList.expectPageSize(25, total);
      return total;
    });

    await test.step('USR-02 Page size can be changed to 10', async () => {
      await usersList.setPageSize(10);
      await usersList.expectPageSize(10, total);
    });

    const user = await test.step('USR-03 Edit opens the selected user', async () => {
      const user = await usersList.pickRandomUser({ exclude: [env.username] });
      test.info().annotations.push({ type: 'picked user', description: `${user.username} (ID ${user.id})` });

      await usersList.clickEdit(user);
      await editPage.expectLoadedFor(user);
      return user;
    });

    await test.step(`USR-04 Change Password opens the password dialog for ${user.username}`, async () => {
      await editPage.openChangePassword();
      await expect(editPage.newPasswordInput).toBeVisible();
      await expect(editPage.newPasswordInput).toBeEmpty();
      await expect(editPage.confirmPasswordInput).toBeVisible();
      await expect(editPage.confirmPasswordInput).toBeEmpty();
      // Stop here: no password is entered or submitted.
    });
  },
);
