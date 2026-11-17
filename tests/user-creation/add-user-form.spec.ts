import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { addUserRoles, newUserData } from '../../data/userRoles';
import { automationUsers } from '../../data/automationUsers';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserAddPage } from '../../pages/UserAddPage';
import { UserEditPage } from '../../pages/UserEditPage';

// Spec: specs/user-creation/add-user-form.md. Only UFORM-04/14 save a user; it is deactivated at the end.
const spec = (...ids: string[]) => specFor('user-creation/add-user-form', ...ids);

/** Role with no mapping, so a form can be completed without dropdowns. */
const plainRole = 'REPORT ADMIN';

/** Opens Add User and enters a fresh, free username so Role and Add are shown. */
async function openWithFreeUsername(page: Page, label = 'form') {
  const addUser = new UserAddPage(page);
  await addUser.goto();
  const username = newUserData.username(label);
  await addUser.enterUsername(username);
  await addUser.expectUsernameAvailable();
  return { addUser, username };
}

/** Every field of a new Add User form is empty, and Role / Add wait for the username check. */
async function expectBlankForm(addUser: UserAddPage) {
  for (const [field, input] of Object.entries(addUser.textFields())) {
    await expect(input, `${field} is empty`).toHaveValue('');
  }
  await expect(addUser.designationButton).toHaveText('Select Designation ...');
  await expect(addUser.roleButton).toBeHidden();
  await expect(addUser.addButton).toBeHidden();
}

test.describe('Add user form', () => {
  test('UFORM-01 New User opens a blank form', spec('UFORM-01'), async ({ authedPage }) => {
    const usersList = new UsersListPage(authedPage);
    const addUser = new UserAddPage(authedPage);
    await usersList.goto();
    await usersList.newUserButton.click();
    await addUser.expectLoaded();
    await expectBlankForm(addUser);
  });

  test('UFORM-02 Username with letters, digits and @ . _ is available', spec('UFORM-02'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();
    await addUser.enterUsername(`e2e.user_${Date.now().toString(36)}@x`);
    await addUser.expectUsernameAvailable();
  });

  test('UFORM-03 A blank username is refused', spec('UFORM-03'), async ({ authedPage }) => {
    test.fail(
      true,
      'App bug (16 Nov 2026): the form is sent with a blank username; the server answers "Username already taken, please try with other name".',
    );
    const { addUser } = await openWithFreeUsername(authedPage);
    await addUser.fillDetails({ password: newUserData.password, name: 'E2E Blank Username' });
    await addUser.selectRole(plainRole);
    await addUser.usernameInput.fill('');
    await addUser.usernameInput.blur();

    // Answer the "continue without a reporting manager?" question the way UADD does, if it comes.
    authedPage.once('dialog', (d) => d.accept().catch(() => {}));
    await addUser.addButton.click();
    await expect(addUser.alertDialog.last(), 'Alert for the blank username').toContainText('User Name cannot be left blank.', { timeout: 5_000 });
    await addUser.closeAlerts();
    await expect(authedPage).toHaveURL(/\/users\/add$/);
    await expect(addUser.nameInput).toHaveValue('E2E Blank Username');
  });

  test(
    'UFORM-04 A name another user already has is accepted; UFORM-14 the new user can log in',
    spec('UFORM-04', 'UFORM-14', 'UFORM-01'),
    async ({ authedPage, loginAs }) => {
      const usersList = new UsersListPage(authedPage);
      const existing = automationUsers.find((u) => u.role === plainRole)!;
      const user = { username: newUserData.username('samename'), password: newUserData.password, id: '' };
      test.info().annotations.push({ type: 'created user', description: `${user.username} (${plainRole})` });

      await test.step(`UFORM-04 Save a user named "${existing.name}" like ${existing.username}`, async () => {
        const addUser = new UserAddPage(authedPage);
        await addUser.goto();
        await addUser.enterUsername(user.username);
        await addUser.expectUsernameAvailable();
        await addUser.fillDetails({ password: user.password, name: existing.name });
        await addUser.selectRole(plainRole);
        await addUser.submit();
        await usersList.expectUserAdded();
        await usersList.search(user.username);
        const found = (await usersList.visibleUsers()).find((u) => u.username === user.username);
        expect(found, `${user.username} in the list`).toBeTruthy();
        user.id = found!.id;
      });

      try {
        await test.step('UFORM-01 The next New User form is blank again', async () => {
          const addUser = new UserAddPage(authedPage);
          await usersList.goto();
          await usersList.newUserButton.click();
          await addUser.expectLoaded();
          await expectBlankForm(addUser);
        });

        await test.step('UFORM-14 The new user logs in on the web', async () => {
          const { appShell } = await loginAs(user.username, user.password);
          await appShell.expectLoggedInAs(plainRole);
        });
      } finally {
        await test.step(`Clean up: deactivate ${user.username}`, async () => {
          const editPage = new UserEditPage(authedPage);
          await editPage.goto(user.id);
          await editPage.saveActive(false);
        });
      }
    },
  );

  test('UFORM-05 The password rule list shows what is missing', spec('UFORM-05'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();
    const red = 'rgb(255, 0, 0)';

    const cases: [string, string][] = [
      ['Mobisy', '1 Digit Needed, 1 Special Character Needed,'],
      ['mobisy', '1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,'],
      ['', 'Minimum 6 Characters requires, 1 Lower Case Letter Needed, 1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,'],
    ];
    for (const [password, expected] of cases) {
      await test.step(`"${password}" → ${expected}`, async () => {
        await addUser.typePassword(password);
        await expect(addUser.passwordStrength).toHaveText(expected);
        await expect(addUser.passwordStrength).toHaveCSS('color', red);
      });
    }
    await test.step('A valid password empties the list', async () => {
      await addUser.typePassword('Mobisy@1');
      await expect(addUser.passwordStrength).toHaveText('');
      await expect(addUser.passwordStrength).toHaveCSS('color', 'rgb(0, 128, 0)');
    });
  });

  test('UFORM-06 An 8-digit phone number is invalid', spec('UFORM-06'), async ({ authedPage }) => {
    const { addUser } = await openWithFreeUsername(authedPage);
    await addUser.enterPhone('98765432');
    await expect(addUser.phoneErrorMessage).toBeVisible();
    await expect(addUser.phoneErrorMessage).toHaveText('Invalid number');
    await expect(addUser.phoneValidMessage).toBeHidden();

    await test.step('Add is refused', async () => {
      await addUser.fillDetails({ password: newUserData.password, name: 'E2E Phone' });
      await addUser.selectRole(plainRole);
      expect(await addUser.submitExpectingAlert()).toBe('Enter valid phone number');
      await expect(authedPage).toHaveURL(/\/users\/add$/);
    });
  });

  test('UFORM-07 A 10-digit phone number is valid', spec('UFORM-07'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();
    await addUser.enterPhone('9876543210');
    await expect(addUser.phoneValidMessage).toBeVisible();
    await expect(addUser.phoneValidMessage).toHaveText('✓ Valid');
    await expect(addUser.phoneErrorMessage).toBeHidden();
  });

  test('UFORM-08 Designation can be picked, before and after picking a role', spec('UFORM-08'), async ({ authedPage }) => {
    const { addUser } = await openWithFreeUsername(authedPage);
    const designations = await addUser.designationOptions();
    expect(designations.length, 'designations offered').toBeGreaterThan(0);

    await addUser.selectDesignation(designations[0]);
    await test.step('After picking a role', async () => {
      await addUser.selectRole(plainRole);
      expect(await addUser.designationOptions()).toEqual(designations);
      await expect(addUser.designationButton).toHaveText(designations[0]);
    });
  });

  test('UFORM-09 Date of birth is picked from a calendar', spec('UFORM-09'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();
    await expect(addUser.dateOfBirthInput).toHaveAttribute('readonly', '');
    await addUser.openCalendar();
    await addUser.pickDate({ year: 1990, month: 5, day: 15 });
    await expect(addUser.dateOfBirthInput).toHaveValue('1990-05-15');
  });

  test('UFORM-10 Date of birth cannot be in the future', spec('UFORM-10'), async ({ authedPage }) => {
    const addUser = new UserAddPage(authedPage);
    await addUser.goto();
    await addUser.openCalendar();
    // The calendar opens on the server's today, which is also ours (both in India).
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    await expect(addUser.dayCell(today.getDate())).not.toHaveClass(/disabled/);
    for (let day = today.getDate() + 1; day <= lastDay; day++) {
      await expect(addUser.dayCell(day), `${day} of this month`).toHaveClass(/disabled/);
    }
    const months = addUser.calendar.locator('.monthselect option');
    for (let month = today.getMonth() + 1; month < 12; month++) {
      await expect(months.nth(month), `month ${month + 1} of this year`).toBeDisabled();
    }

    if (today.getDate() < lastDay) {
      await test.step('Clicking a later day picks nothing', async () => {
        await addUser.dayCell(today.getDate() + 1).click({ force: true });
        await expect(addUser.dateOfBirthInput).toHaveValue('');
      });
    }
  });

  test('UFORM-11 Role mapping dropdowns appear one after another', spec('UFORM-11'), async ({ authedPage }) => {
    const { addUser } = await openWithFreeUsername(authedPage);
    const steps = addUserRoles.find((r) => r.label === 'DISTRIBUTOR SALESMAN')!.mapping;
    expect(steps.map((s) => s.field)).toEqual(['ZONE', 'Subzone', 'DISTRIBUTOR', 'AREA']);

    await addUser.selectRole('DISTRIBUTOR SALESMAN');
    for (const [i, step] of steps.entries()) {
      const next = steps[i + 1];
      await test.step(`${step.field} is shown${next ? `, ${next.field} not yet` : ''}`, async () => {
        await expect(addUser.mappingLabel(step.field)).toBeVisible({ timeout: 15_000 });
        if (next) await expect(addUser.mappingLabel(next.field)).toBeHidden();
      });
      await addUser.fillMapping([step]);
    }
  });

  test('UFORM-12 Add is refused when the role mapping cannot load', spec('UFORM-12'), async ({ authedPage, serverErrors }) => {
    await authedPage.route('**/users/getidsforrole/**', (route) => route.fulfill({ status: 500, body: '' }));

    const { addUser } = await openWithFreeUsername(authedPage);
    await addUser.fillDetails({ password: newUserData.password, name: 'E2E No Mapping' });
    await addUser.selectRole('ZONE MANAGER');
    expect(await addUser.submitExpectingAlert()).toBe('Please select a Role details.');
    await expect(authedPage).toHaveURL(/\/users\/add$/);
    await expect(addUser.heading).toBeVisible();
    serverErrors.expectNone({ ignore: /\/users\/getidsforrole\// });
  });

  test('UFORM-13 User custom fields keep their configured order', spec('UFORM-13'), async () => {
    test.fixme(true, 'devarun has no user custom fields (16 Nov 2026); creating them changes the form for every user.');
  });
});
