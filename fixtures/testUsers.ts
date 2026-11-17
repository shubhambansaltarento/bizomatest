import { test, expect, type Page } from '@playwright/test';
import { addUserRoles, newUserData, type AddUserRoleLabel } from '../data/userRoles';
import { UserAddPage } from '../pages/UserAddPage';
import { UserEditPage } from '../pages/UserEditPage';
import { UsersListPage } from '../pages/UsersListPage';

/** A user a test created for itself (automation prefix `e2e.`). */
export type TestUser = { id: string; username: string; password: string; name: string; role: AddUserRoleLabel };

export type NewTestUserOptions = { role: AddUserRoleLabel; designation?: string };

/**
 * Creates a user through Users → New User as the logged-in admin, with the role's mapping from
 * data/userRoles.ts.
 *
 * Tests don't call this directly: they use the `newTestUser` fixture (fixtures/auth.fixture.ts),
 * which also deactivates the user after the test.
 */
export async function createTestUser(page: Page, { role, designation }: NewTestUserOptions): Promise<TestUser> {
  const user: TestUser = { id: '', username: newUserData.username(role), password: newUserData.password, name: newUserData.name(role), role };
  await test.step(`Admin creates ${user.username} (${role})`, async () => {
    const addUser = new UserAddPage(page);
    const usersList = new UsersListPage(page);
    await addUser.goto();
    await addUser.enterUsername(user.username);
    await addUser.expectUsernameAvailable();
    await addUser.fillDetails({ password: user.password, name: user.name });
    if (designation) await addUser.selectDesignation(designation);
    await addUser.selectRole(role);
    await addUser.fillMapping(addUserRoles.find((r) => r.label === role)!.mapping);
    await addUser.submit();
    // The list's first Ajax load can overwrite a search typed too early: wait for it, and search
    // again if the user still isn't shown.
    await usersList.expectLoaded();
    await expect(async () => {
      await usersList.search(user.username);
      const found = (await usersList.visibleUsers()).find((u) => u.username === user.username);
      expect(found, `${user.username} in the users list`).toBeTruthy();
      user.id = found!.id;
    }).toPass({ timeout: 30_000 });
  });
  test.info().annotations.push({ type: 'created user', description: `${user.username} (ID ${user.id}, ${role})` });
  return user;
}

/** Marks a test user inactive (clean-up; also fine if it already is). */
export async function deactivateTestUser(page: Page, user: TestUser) {
  if (!user.id) return;
  await test.step(`Clean up: deactivate ${user.username}`, async () => {
    const editPage = new UserEditPage(page);
    await editPage.goto(user.id);
    if (await editPage.activeCheckbox.isChecked()) await editPage.saveActive(false);
  });
}
