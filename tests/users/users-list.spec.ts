import fs from 'node:fs';
import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { env } from '../../config/env';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';
import { UserAddPage } from '../../pages/UserAddPage';

// Spec: specs/users/users-list.md — one test per acceptance criterion. Read-only: nothing is changed.
const spec = (id: string) => specFor('users/users-list', id);

test.describe('Users list', () => {
  let usersList: UsersListPage;

  test.beforeEach(async ({ authedPage }) => {
    usersList = new UsersListPage(authedPage);
    await usersList.goto();
  });

  test('ULIST-01 The list shows its controls and columns', spec('ULIST-01'), async () => {
    await expect(usersList.heading).toBeVisible();
    await expect(usersList.newUserButton).toBeVisible();
    await expect(usersList.downloadButton).toBeVisible();
    await expect(usersList.statusFilter.active).toBeChecked();
    await expect(usersList.statusFilter.inactive).not.toBeChecked();
    await expect(usersList.statusFilter.all).not.toBeChecked();
    await expect(usersList.activeCount).toBeVisible();
    await expect(usersList.inactiveCount).toBeVisible();
    await expect(usersList.headers).toHaveText(UsersListPage.columns);
  });

  test('ULIST-02 Status filter shows active, inactive or all users', spec('ULIST-02'), async () => {
    await usersList.setPageSize(100);
    const counts = await usersList.statusCounts();

    await test.step('Active Users', async () => {
      expect((await usersList.readSummary()).total).toBe(counts.active);
      expect(new Set(await usersList.columnValues('Status'))).toEqual(new Set(['Active']));
    });

    await test.step('Inactive Users', async () => {
      await usersList.showStatus('inactive');
      await expect(usersList.summary).toContainText(`of ${counts.inactive} entr`);
      if (counts.inactive) expect(new Set(await usersList.columnValues('Status'))).toEqual(new Set(['Inactive']));
    });

    await test.step('All Users', async () => {
      await usersList.showStatus('all');
      await expect(usersList.summary).toContainText(`of ${counts.active + counts.inactive} entr`);
    });
  });

  test('ULIST-03 Paging buttons move between pages', spec('ULIST-03'), async () => {
    await usersList.setPageSize(10);
    const { total } = await usersList.readSummary();
    test.skip(total <= 10, `Only ${total} active users: paging needs more than 10.`);
    const lastFrom = Math.floor((total - 1) / 10) * 10 + 1;

    await test.step('Page 1: First and Previous disabled', async () => {
      await expect(usersList.summary).toHaveText(`Showing 1 to 10 of ${total} entries`);
      await usersList.expectPageButtonEnabled('First', false);
      await usersList.expectPageButtonEnabled('Previous', false);
      await usersList.expectPageButtonEnabled('Next', true);
      await usersList.expectPageButtonEnabled('Last', true);
    });

    await test.step('Next', async () => {
      await usersList.goToPage('Next');
      await expect(usersList.summary).toHaveText(new RegExp(`^Showing 11 to \\d+ of ${total} entries`));
      await expect(usersList.pageButton('2')).toHaveAttribute('aria-current', 'page');
    });

    await test.step('Last: Next and Last disabled', async () => {
      await usersList.goToPage('Last');
      await expect(usersList.summary).toHaveText(`Showing ${lastFrom} to ${total} of ${total} entries`);
      await usersList.expectPageButtonEnabled('Next', false);
      await usersList.expectPageButtonEnabled('Last', false);
    });

    await test.step('Previous, then First', async () => {
      await usersList.goToPage('Previous');
      await expect(usersList.summary).toHaveText(new RegExp(`^Showing ${Math.max(lastFrom - 10, 1)} to `));
      if (lastFrom - 10 > 1) await usersList.goToPage('First');
      await expect(usersList.summary).toHaveText(`Showing 1 to 10 of ${total} entries`);
      await expect(usersList.pageButton('1')).toHaveAttribute('aria-current', 'page');
    });

    await test.step('Page number 2', async () => {
      await usersList.goToPage('2');
      await expect(usersList.summary).toHaveText(new RegExp(`^Showing 11 to \\d+ of ${total} entries`));
    });
  });

  test('ULIST-04 Search filters the rows', spec('ULIST-04'), async () => {
    const { total } = await usersList.readSummary();

    await test.step(`Search for "${env.username}"`, async () => {
      await usersList.search(env.username);
      await expect(usersList.summary).toContainText(`(filtered from ${total} total entries)`);
      expect(await usersList.columnValues('User Name')).toContain(env.username);
      for (const text of await usersList.rows.allInnerTexts()) {
        expect(text.toLowerCase(), 'every row matches the search').toContain(env.username.toLowerCase());
      }
    });

    await test.step('Search with no match', async () => {
      await usersList.search(`no-such-user-${Date.now()}`);
      await expect(usersList.rows).toHaveText(['No matching records found']);
      await expect(usersList.summary).toHaveText(new RegExp(`^Showing 0 to 0 of 0 entries`));
    });

    await test.step('Clear the search', async () => {
      await usersList.search('');
      expect((await usersList.readSummary()).total).toBe(total);
    });
  });

  test('ULIST-05 Sorting by User Name', spec('ULIST-05'), async () => {
    await usersList.setPageSize(100);
    const { total } = await usersList.readSummary();
    test.skip(total > 100, `${total} users don't fit on one page; the reversed-order check needs them all.`);

    expect(await usersList.sortBy('User Name')).toBe('ascending');
    const ascending = await usersList.columnValues('User Name');
    expect(await usersList.sortBy('User Name')).toBe('descending');
    expect(await usersList.columnValues('User Name')).toEqual([...ascending].reverse());
  });

  test('ULIST-06 Row action buttons open the user\'s pages', spec('ULIST-06'), async ({ authedPage: page, appShell }) => {
    const users = await usersList.visibleUsers();

    await test.step('Every row links its actions to its own user', async () => {
      for (const user of users) {
        const actions = usersList.rowActions(user.row);
        await expect.soft(actions.edit, `Edit of ${user.username}`).toHaveAttribute('href', `/users/edit/${user.id}`);
        await expect.soft(actions.map, `map of ${user.username}`).toHaveAttribute('href', `/users/usermapview/${user.id}`);
        if (await actions.pjp.count()) {
          await expect.soft(actions.pjp, `Pjp of ${user.username}`).toHaveAttribute('href', `/pjps/pjpupdate/${user.id}`);
        }
      }
    });

    // Never the logged-in admin: clicking through only reads, but keep the shared account out of it.
    const others = users.filter((u) => u.username !== env.username);
    const withPjp = [];
    for (const u of others) if (await usersList.rowActions(u.row).pjp.count()) withPjp.push(u);

    if (withPjp.length) {
      const user = withPjp[0];
      await test.step(`Pjp of ${user.username} opens in a new tab`, async () => {
        const [tab] = await Promise.all([page.context().waitForEvent('page'), usersList.rowActions(user.row).pjp.click()]);
        await expect(tab).toHaveURL(new RegExp(`/pjps/pjpupdate/${user.id}$`));
        await expect(tab.locator('body')).not.toContainText(appShell.errorText);
        await tab.close();
      });
    }

    const user = others[0];
    await test.step(`Map of ${user.username}`, async () => {
      await usersList.rowActions(user.row).map.click();
      await expect(page).toHaveURL(new RegExp(`/users/usermapview/${user.id}$`));
      await appShell.expectLoggedIn();
      await expect(page.locator('body')).not.toContainText(appShell.errorText);
    });

    await test.step(`Edit of ${user.username}`, async () => {
      await usersList.goto();
      const row = (await usersList.visibleUsers()).find((u) => u.id === user.id)!;
      await usersList.clickEdit(row);
      await new UserEditPage(page).expectLoadedFor(user);
    });
  });

  test('ULIST-07 Download gives a CSV of users', spec('ULIST-07'), async ({ authedPage: page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), usersList.downloadButton.click()]);

    const today = new Date();
    const date = [today.getDate(), today.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('-') + `-${today.getFullYear()}`;
    expect(download.suggestedFilename()).toBe(`User_List_${date}.csv`);
    const { size } = await fs.promises.stat(await download.path());
    expect(size, 'CSV size in bytes').toBeGreaterThan(0);
  });

  test('ULIST-08 New User opens the Add User form', spec('ULIST-08'), async ({ authedPage: page }) => {
    await usersList.newUserButton.click();
    await new UserAddPage(page).expectLoaded();
  });
});
