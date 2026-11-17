import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { automationUsers } from '../../data/automationUsers';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';
import { UserDetailsPage } from '../../pages/UserDetailsPage';

// Spec: specs/users/edit-user.md. Every test creates its own user (`newTestUser` deactivates it afterwards).
const spec = (...ids: string[]) => specFor('users/edit-user', ...ids);

test.describe('Edit user', () => {
  test(
    'UEDIT-01 Edit opens the user\'s form; UEDIT-02 changed details are saved and shown',
    spec('UEDIT-01', 'UEDIT-02'),
    async ({ authedPage, newTestUser }) => {
      const usersList = new UsersListPage(authedPage);
      const editPage = new UserEditPage(authedPage);
      const details = new UserDetailsPage(authedPage);
      const user = await newTestUser({ role: 'REPORT ADMIN' });
      const stamp = Date.now().toString(36);
      const changed = { name: `E2E Edited ${stamp}`, email: `${user.username}@example.com`, address: `${stamp} Test Street`, employeeId: `EMP${stamp}` };

      await test.step('UEDIT-01 Edit in the users list opens the user\'s form', async () => {
        await usersList.goto();
        await usersList.search(user.username);
        const row = (await usersList.visibleUsers()).find((u) => u.id === user.id)!;
        await usersList.clickEdit(row);
        await editPage.expectLoadedFor(user);
        await expect(editPage.heading).toBeVisible();
        await expect(editPage.usernameInput, 'username is read-only').not.toBeEditable();
        await expect(editPage.nameInput).toHaveValue(user.name);
        await expect(editPage.currentRole).toContainText(user.role);
        await expect(editPage.editRoleLink).toBeVisible();
        await expect(editPage.saveButton).toBeVisible();
      });

      await test.step('UEDIT-02 Change Name, Email, Address and Employee Id, and save', async () => {
        await editPage.nameInput.fill(changed.name);
        await editPage.emailInput.fill(changed.email);
        await editPage.addressInput.fill(changed.address);
        await editPage.employeeIdInput.fill(changed.employeeId);
        await editPage.save();
        await usersList.expectUserSaved();
      });

      await test.step('UEDIT-02 The details page shows the new values', async () => {
        await details.goto(user.id);
        await expect(details.field('Name')).toHaveText(changed.name);
        await expect(details.field('Email')).toContainText(changed.email);
        await expect(details.field('Address')).toHaveText(changed.address);
        await expect(details.field('Employee ID')).toHaveText(changed.employeeId);
      });

      await test.step('UEDIT-02 The Edit page shows the new values', async () => {
        await editPage.goto(user.id);
        await expect(editPage.nameInput).toHaveValue(changed.name);
        await expect(editPage.emailInput).toHaveValue(changed.email);
        await expect(editPage.addressInput).toHaveValue(changed.address);
        await expect(editPage.employeeIdInput).toHaveValue(changed.employeeId);
      });
    },
  );

  test('UEDIT-03 An invalid email is refused', spec('UEDIT-03'), async ({ authedPage, newTestUser }) => {
    const usersList = new UsersListPage(authedPage);
    const editPage = new UserEditPage(authedPage);
    const user = await newTestUser({ role: 'REPORT ADMIN' });
    const email = `${user.username}@example.com`;

    await test.step('"not-an-email" is refused', async () => {
      await editPage.goto(user.id);
      await editPage.emailInput.fill('not-an-email');
      expect(await editPage.saveExpectingAlert()).toBe('Enter valid Email id');
      await expect(authedPage).toHaveURL(new RegExp(`/users/edit/${user.id}$`));
    });

    await test.step('The corrected email is saved', async () => {
      await editPage.emailInput.fill(email);
      await editPage.save();
      await usersList.expectUserSaved();
      const details = new UserDetailsPage(authedPage);
      await details.goto(user.id);
      await expect(details.field('Email')).toContainText(email);
    });
  });

  test('UEDIT-04 A blank name is refused', spec('UEDIT-04'), async ({ authedPage, newTestUser }) => {
    test.fail(true, 'App bug (17 Nov 2026): Edit saves a user with a blank name ("The user has been saved"); Add User refuses it (UVAL-02).');
    const editPage = new UserEditPage(authedPage);
    const user = await newTestUser({ role: 'REPORT ADMIN' });

    await editPage.goto(user.id);
    await editPage.nameInput.fill('');
    await editPage.saveButton.click();
    await expect(editPage.validationAlert.last(), 'Alert for the blank name').toContainText('Name is a mandatory field', { timeout: 5_000 });
    await expect(authedPage).toHaveURL(new RegExp(`/users/edit/${user.id}$`));
  });

  test('UEDIT-05 The role can be changed', spec('UEDIT-05'), async ({ authedPage, newTestUser, serverErrors }) => {
    const usersList = new UsersListPage(authedPage);
    const editPage = new UserEditPage(authedPage);
    const user = await newTestUser({ role: 'REPORT ADMIN' });

    await test.step('ZONE MANAGER without a zone is refused', async () => {
      await editPage.goto(user.id);
      await editPage.editRole();
      await editPage.selectRole('ZONE MANAGER');
      await expect(editPage.mappingLabel('ZONE'), 'ZONE dropdown shown').toBeVisible();
      expect(await editPage.saveExpectingAlert()).toBe('Please select Role details');
      await expect(authedPage).toHaveURL(new RegExp(`/users/edit/${user.id}$`));
      serverErrors.expectNone();
    });

    await test.step('With the zone South it is saved', async () => {
      await editPage.selectMapping('ZONE', 'South');
      await editPage.save();
      await usersList.expectUserSaved();
    });

    await test.step('The details and Edit pages show ZONE MANAGER for South', async () => {
      const details = new UserDetailsPage(authedPage);
      await details.goto(user.id);
      await expect(details.field('Role')).toHaveText('ZONE MANAGER');
      await expect(details.field('For')).toContainText('South');
      await editPage.goto(user.id);
      await expect(editPage.currentRole).toContainText('ZONE MANAGER');
      serverErrors.expectNone();
    });
  });

  test('UEDIT-06 Reporting To of a distributor sales manager is kept', spec('UEDIT-06'), async ({ authedPage, newTestUser }) => {
    const usersList = new UsersListPage(authedPage);
    const editPage = new UserEditPage(authedPage);
    const manager = automationUsers.find((u) => u.role === 'SALES MANAGER')!;
    const reportingTo = `${manager.id} - ${manager.name}`;
    const user = await newTestUser({ role: 'DISTRIBUTOR SALES MANAGER' });

    await test.step(`Set Reporting To "${reportingTo}" and save`, async () => {
      await editPage.goto(user.id);
      await editPage.editRole();
      await editPage.selectReportingTo(reportingTo);
      await editPage.save();
      await usersList.expectUserSaved();
    });

    await test.step('Opened again, Reporting To is filled in', async () => {
      await editPage.goto(user.id);
      await editPage.editRole();
      await expect(editPage.reportingToButton).toHaveText(reportingTo);
    });

    await test.step('Saved without changes and opened again, it is still filled in', async () => {
      await editPage.save();
      await usersList.expectUserSaved();
      await editPage.goto(user.id);
      await editPage.editRole();
      await expect(editPage.reportingToButton).toHaveText(reportingTo);
    });
  });
});
