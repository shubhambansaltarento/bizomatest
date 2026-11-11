import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { env } from '../../config/env';
import { addUserRoles, newUserData } from '../../data/userRoles';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserAddPage } from '../../pages/UserAddPage';
import { UserEditPage } from '../../pages/UserEditPage';

// Spec: specs/users/add-user.md. Roles and their mappings: data/userRoles.ts.
// UADD-03 creates real users (one per role) on the environment, then deactivates them (the app has no delete).
const spec = (id: string) => specFor('users/add-user', id);

test.describe('Add user', () => {
  test('UADD-01 A username that is taken is refused', spec('UADD-01'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();

    await addUser.enterUsername(env.username);
    await addUser.expectUsernameTaken();

    await test.step('The check ignores case', async () => {
      await addUser.enterUsername(env.username.toUpperCase());
      await addUser.expectUsernameTaken();
    });
  });

  test('UADD-02 A free username unlocks the Role dropdown with every role', spec('UADD-02'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();

    await addUser.enterUsername(newUserData.username('free'));
    await addUser.expectUsernameAvailable();
    expect(await addUser.roleOptions()).toEqual(addUserRoles.map((r) => r.label));
  });

  for (const role of addUserRoles) {
    test(`UADD-03 Admin can create a user: ${role.label}`, spec('UADD-03'), async ({ authedPage }) => {
      const usersList = new UsersListPage(authedPage);
      const addUser = new UserAddPage(authedPage);
      const user = { username: newUserData.username(role.label), name: newUserData.name(role.label) };
      test.info().annotations.push({ type: 'created user', description: `${user.username} (${role.label})` });

      await test.step('Open New User from the users list', async () => {
        await usersList.goto();
        await usersList.newUserButton.click();
        await addUser.expectLoaded();
      });

      await test.step('Fill in the form', async () => {
        await addUser.enterUsername(user.username);
        await addUser.expectUsernameAvailable();
        await addUser.fillDetails({ password: newUserData.password, name: user.name });
        await addUser.selectRole(role.label);
        await addUser.fillMapping(role.mapping);
      });

      await test.step('Add saves the user', async () => {
        await addUser.submit();
        // Checked first: the message hides itself after a few seconds.
        await expect(usersList.flashMessage).toContainText('User added successfully');
        await expect(usersList.flashMessage).toHaveClass(/success-message/);
        await usersList.expectLoaded();
      });

      const id = await test.step('The new user is in the list with the role', async () => {
        await usersList.search(user.username);
        const found = (await usersList.visibleUsers()).filter((u) => u.username === user.username);
        expect(found, `rows for ${user.username}`).toHaveLength(1);
        expect(found[0].role).toBe(role.label);
        const row = found[0].row;
        await expect(row.locator('td').nth(UsersListPage.columns.indexOf('Name'))).toHaveText(user.name);
        await expect(row.locator('td').nth(UsersListPage.columns.indexOf('Status'))).toHaveText('Active');
        return found[0].id;
      });

      // Not a criterion: keeps the active users list from growing by 13 users every run.
      await test.step(`Clean up: deactivate ${user.username}`, async () => {
        const editPage = new UserEditPage(authedPage);
        await editPage.goto(id);
        await editPage.expectLoadedFor({ id, username: user.username });
        await editPage.saveActive(false);
        await expect(usersList.flashMessage).toContainText('The user has been saved');
      });
    });
  }
});
