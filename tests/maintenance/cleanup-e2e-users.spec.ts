import { test, expect } from '../../fixtures/auth.fixture';
import { automationUserPrefix, automationUsers, isAutomationUser } from '../../data/automationUsers';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';

/**
 * Maintenance, not a test of the app: deactivates every active automation user ("e2e.*") except
 * the fixed accounts in data/automationUsers.ts, e.g. users left active by an interrupted run.
 * The app has no delete, so deactivating is the clean-up. Skipped in normal runs; run it with
 *
 *   npm run cleanup:e2e-users
 */
test.skip(!process.env.E2E_CLEANUP, 'Maintenance only: run with `npm run cleanup:e2e-users`.');

test('Deactivate leftover automation users', async ({ authedPage }) => {
  test.setTimeout(30 * 60_000);
  const keep = new Set(automationUsers.map((u) => u.username));
  const usersList = new UsersListPage(authedPage);
  const editPage = new UserEditPage(authedPage);

  // Active users whose username starts with "e2e." (the list shows Active Users by default).
  const leftovers = async () => {
    await usersList.goto();
    await usersList.setPageSize(100);
    await usersList.search(automationUserPrefix);
    return (await usersList.visibleUsers()).filter((u) => isAutomationUser(u.username) && !keep.has(u.username));
  };

  let batch = await leftovers();
  // Each pass handles up to one page (100 users); repeat until none are left.
  while (batch.length) {
    for (const { id, username } of batch) {
      await test.step(`Deactivate ${username} (ID ${id})`, async () => {
        await editPage.goto(id);
        await editPage.expectLoadedFor({ id, username });
        await editPage.saveActive(false);
        await expect(usersList.flashMessage).toContainText('The user has been saved');
        test.info().annotations.push({ type: 'deactivated', description: `${username} (ID ${id})` });
      });
    }
    batch = await leftovers();
  }
});
