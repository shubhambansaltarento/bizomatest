import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { deactivateTestUser } from '../../fixtures/testUsers';
import { freshPassword } from '../../data/automationUsers';
import { UserEditPage } from '../../pages/UserEditPage';

// Spec: specs/users/user-password-status.md. The test creates its own user, which ends inactive.
const spec = (...ids: string[]) => specFor('users/user-password-status', ...ids);

test.describe('Admin sets a user\'s password; inactive users can\'t log in', () => {
  test(
    'UPST-01 The Change Password dialog opens without errors; UPST-02 an invalid password is refused; UPST-03 an inactive user can\'t log in',
    spec('UPST-01', 'UPST-02', 'UPST-03'),
    async ({ authedPage, loginAs, newTestUser, serverErrors }) => {
      const editPage = new UserEditPage(authedPage);
      const user = await newTestUser({ role: 'REPORT ADMIN' });
      const password = freshPassword();

      await test.step('UPST-01 The dialog opens without errors', async () => {
        await editPage.goto(user.id);
        await editPage.openChangePassword();
        await expect(editPage.passwordTips).toHaveText('All form fields are required.');
        await expect(editPage.newPasswordInput).toHaveValue('');
        await expect(editPage.confirmPasswordInput).toHaveValue('');
        await expect(editPage.passwordRules).toHaveText('');
        await expect(editPage.passwordDialog).toContainText('password complexity');
        serverErrors.expectNone();
      });

      await test.step('UPST-02 "abc" is refused', async () => {
        await editPage.enterNewPassword('abc');
        await editPage.submitPasswordButton.click();
        await expect(editPage.passwordTips).toHaveText('Password Not Valid');
        await expect(editPage.passwordRules).toHaveText(
          'Minimum 6 Characters requires, 1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,',
        );
        await expect(editPage.passwordDialog).toBeVisible();
      });

      await test.step('UPST-02 A valid password is accepted', async () => {
        await editPage.enterNewPassword(password);
        await editPage.submitPasswordButton.click();
        await expect(editPage.alertDialog).toContainText('Successfully changed password');
        await editPage.alertDialog.getByRole('button', { name: 'Ok' }).click();
      });

      await test.step('UPST-03 Once inactive, the user can\'t log in', async () => {
        // Deactivating is the action under test here, not the clean-up.
        await deactivateTestUser(authedPage, user);
        const { loginPage } = await loginAs(user.username, password);
        await loginPage.expectVisible();
        await expect(loginPage.message('Invalid username or password.')).toBeVisible();
      });
    },
  );
});
