import { expect, type Locator, type Page } from '@playwright/test';

/** Edit user form at /users/edit/<id>. */
export class UserEditPage {
  readonly usernameInput: Locator;
  /** Changes the password of the user being edited (not the navbar item, which is your own). */
  readonly changePasswordButton: Locator;
  readonly passwordDialog: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitPasswordButton: Locator;
  readonly alertDialog: Locator;
  /** "active" checkbox: unticked and saved, the user becomes inactive. */
  readonly activeCheckbox: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.locator('#UserUsername');
    // Not #changepwdlink: the app reuses that id for "Remove Picture & Location".
    this.changePasswordButton = page.locator('#formUserAdd').getByRole('link', { name: 'Change Password' });
    this.passwordDialog = page.locator('.ui-dialog').filter({ hasText: 'Password Change' });
    this.newPasswordInput = this.passwordDialog.locator('#changepwd');
    this.confirmPasswordInput = this.passwordDialog.locator('#changepwdcnf');
    this.submitPasswordButton = this.passwordDialog.getByRole('button', { name: 'Change Password' });
    this.alertDialog = page.locator('.ui-dialog').filter({ has: page.locator('.alert') });
    this.activeCheckbox = page.locator('#UserActive');
    this.saveButton = page.locator('#addsubmit');
  }

  async goto(id: string) {
    await this.page.goto(`/users/edit/${id}`);
    await expect(this.usernameInput).toBeVisible();
  }

  /** Ticks or unticks "active" and saves; the app goes back to the users list. */
  async saveActive(active: boolean) {
    await Promise.all([
      // Unticking loads the "Reason For Inactivating User" options; saving before that finishes
      // was seen to lose the "saved" message.
      active ? Promise.resolve() : this.page.waitForResponse((r) => /reason/i.test(r.url()), { timeout: 10_000 }).catch(() => {}),
      this.activeCheckbox.setChecked(active),
    ]);
    await this.page.waitForTimeout(500);
    // Saving can ask for confirmation (e.g. reporting-manager hierarchy); answer OK.
    this.page.once('dialog', (d) => d.accept().catch(() => {}));
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/\/users\/ajaxuserindex/, { timeout: 45_000 });
  }

  async expectLoadedFor(user: { id: string; username: string }) {
    await expect(this.page).toHaveURL(new RegExp(`/users/edit/${user.id}$`));
    await expect(this.usernameInput).toHaveValue(user.username);
  }

  async openChangePassword() {
    await this.changePasswordButton.click();
    await expect(this.passwordDialog).toBeVisible();
  }

  /** Submits the Password Change dialog and dismisses the success alert. */
  async changePassword(newPassword: string) {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.submitPasswordButton.click();
    await expect(this.alertDialog).toContainText('Successfully changed password');
    await this.alertDialog.getByRole('button', { name: 'Ok' }).click();
    await expect(this.alertDialog).toBeHidden();
  }
}
