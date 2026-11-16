import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type AppSettings } from '../../../fixtures/settings.fixture';
import { spec as specFor } from '../../../fixtures/spec';
import { newUserData } from '../../../data/userRoles';
import { UserAddPage } from '../../../pages/UserAddPage';
import { UserEditPage } from '../../../pages/UserEditPage';
import { UsersListPage } from '../../../pages/UsersListPage';

// Spec: specs/user-creation/config/user-images.md. Config test: run with `npm run test:user-creation:config`.
const spec = (...ids: string[]) => specFor('user-creation/config/user-images', ...ids);

const role = 'REPORT ADMIN';
const image = (n: number) => path.resolve(__dirname, '../../../data/images', `user-image-${n}.png`);

/**
 * Creates an automation user, switches attendanceFaceVerification on for that user only, runs the
 * body on the user's Edit page, then (pass or fail) restores the setting and deactivates the user.
 */
async function withImageUser(page: Page, appSettings: AppSettings, body: (editPage: UserEditPage, userId: string) => Promise<void>) {
  const usersList = new UsersListPage(page);
  const editPage = new UserEditPage(page);
  const user = { role, username: newUserData.username(role), id: '' };

  await test.step(`Admin creates ${user.username}`, async () => {
    const addUser = new UserAddPage(page);
    await addUser.goto();
    await addUser.enterUsername(user.username);
    await addUser.expectUsernameAvailable();
    await addUser.fillDetails({ password: newUserData.password, name: `E2E ${role}` });
    await addUser.selectRole(role);
    await addUser.submit();
    await usersList.search(user.username);
    user.id = (await usersList.visibleUsers()).find((u) => u.username === user.username)!.id;
    test.info().annotations.push({ type: 'created user', description: `${user.username} (ID ${user.id})` });
  });

  try {
    await appSettings.setForUser('attendanceFaceVerification', user, '1');
    await body(editPage, user.id);
  } finally {
    try {
      await test.step('Clean up: restore settings', () => appSettings.restoreNow());
    } finally {
      await test.step(`Clean up: deactivate ${user.username}`, async () => {
        await editPage.goto(user.id);
        await editPage.saveActive(false);
      });
    }
  }
}

test.describe('User attendance verification images', () => {
  test.describe.configure({ timeout: 10 * 60_000 });

  test(
    'UIMG-01..04 Admin uploads 3 to 5 images when attendanceFaceVerification is on',
    spec('UIMG-01', 'UIMG-02', 'UIMG-03', 'UIMG-04'),
    async ({ authedPage, appSettings }) => {
      const usersList = new UsersListPage(authedPage);
      const serverErrors: string[] = [];
      authedPage.on('response', (r) => {
        if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
      });

      await withImageUser(authedPage, appSettings, async (editPage, userId) => {
        await test.step('UIMG-01 The images field is shown, empty', async () => {
          await editPage.goto(userId);
          await expect(editPage.imageUploadRow).toBeVisible();
          await editPage.openImages();
          await expect(editPage.imageUploadInput).toBeVisible();
          await expect(editPage.uploadedImages).toHaveCount(0);
        });

        await test.step('UIMG-02 Fewer than 3 images are refused', async () => {
          await editPage.uploadImages([image(1), image(2)]);
          expect(await editPage.saveExpectingAlert()).toBe('A minimum of 3 user images are mandatory.');
          await expect(authedPage).toHaveURL(new RegExp(`/users/edit/${userId}$`));
        });

        await test.step('UIMG-03 Three images are saved without a server error', async () => {
          await editPage.uploadImages([image(3)]);
          await editPage.save();
          await expect(usersList.flashMessage).toContainText('The user has been saved');
          expect(serverErrors, 'responses with a 5xx status').toEqual([]);
          await editPage.goto(userId);
          await editPage.openImages();
          await expect(editPage.uploadedImages).toHaveCount(3);
        });

        await test.step('UIMG-04 A 6th image is refused', async () => {
          await expect(editPage.imageLimitMessage).toBeHidden();
          await editPage.uploadImages([image(4), image(5)]);
          await editPage.imageUploadInput.setInputFiles([image(1)]);
          await expect(editPage.imageLimitMessage).toBeVisible();
          await expect(editPage.imageUploadInput).toBeHidden();
          await expect(editPage.uploadedImages).toHaveCount(5);
        });

        await test.step('UIMG-04 Reopened with 5 images, no more can be added', async () => {
          await editPage.save();
          await editPage.goto(userId);
          await editPage.openImages();
          await expect(editPage.uploadedImages).toHaveCount(5);
          await expect(editPage.imageUploadInput).toBeHidden();
          await expect(editPage.imageUploadInput).toBeDisabled();
          await expect(editPage.imageLimitMessage).toHaveText('You have uploaded 5 images. No more uploads allowed.');
          await expect(editPage.imageLimitMessage).toHaveCSS('color', 'rgb(255, 0, 0)');
        });
      });
    },
  );

  test('UIMG-05 Right after the 5th image, no more can be added', spec('UIMG-05'), async ({ authedPage, appSettings }) => {
    test.fail(
      true,
      'App bug (16 Nov 2026): the limit is checked before the uploads finish, so after the 5th image the file input is still offered and the message only shows when a 6th is tried (or after reopening).',
    );
    await withImageUser(authedPage, appSettings, async (editPage, userId) => {
      await editPage.goto(userId);
      await editPage.openImages();
      await editPage.uploadImages([image(1), image(2), image(3), image(4), image(5)]);
      await expect(editPage.imageUploadInput).toBeDisabled();
      await expect(editPage.imageUploadInput).toBeHidden();
      await expect(editPage.imageLimitMessage).toBeVisible();
    });
  });
});
