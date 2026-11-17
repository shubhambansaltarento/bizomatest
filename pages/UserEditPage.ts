import { expect, type Locator, type Page } from '@playwright/test';
import { multiselectButton, pickInMultiselect } from './multiselect';

/** Edit user form at /users/edit/<id>. */
export class UserEditPage {
  readonly heading: Locator;
  /** Read-only on this page: a username can't be changed. */
  readonly usernameInput: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly addressInput: Locator;
  readonly employeeIdInput: Locator;
  /** Shown but disabled on this page (seen 17 Nov 2026), also after Edit Role. */
  readonly designationButton: Locator;
  /** The user's current role as text ("Role * ZONE MANAGER"); replaced by the Role dropdown after Edit Role. */
  readonly currentRole: Locator;
  readonly editRoleLink: Locator;
  /** Role dropdown, shown after Edit Role. */
  readonly roleButton: Locator;
  /** "Select Reporting To" dropdown, shown after Edit Role for roles that report to someone. */
  readonly reportingToButton: Locator;
  /** Changes the password of the user being edited (not the navbar item, which is your own). */
  readonly changePasswordButton: Locator;
  readonly passwordDialog: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitPasswordButton: Locator;
  /** Line at the top of the Password Change dialog: "All form fields are required.", then the error. */
  readonly passwordTips: Locator;
  /** What the new password still misses, e.g. "Minimum 6 Characters requires, 1 Digit Needed, ...". */
  readonly passwordRules: Locator;
  readonly alertDialog: Locator;
  /** "active" checkbox: unticked and saved, the user becomes inactive. */
  readonly activeCheckbox: Locator;
  readonly saveButton: Locator;
  /** "User Attendance Verification Images": only there when attendanceFaceVerification is on for the user. */
  readonly imageUploadRow: Locator;
  /** File input (several files at once); hidden once 5 images are uploaded. */
  readonly imageUploadInput: Locator;
  /** One per uploaded image; its hidden input holds the stored image's URL once the upload is done. */
  readonly uploadedImages: Locator;
  /** "You have uploaded 5 images. No more uploads allowed." */
  readonly imageLimitMessage: Locator;
  /** The app's "Alert" dialog for validation errors on Save. */
  readonly validationAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.locator('h5.form-title').filter({ hasText: 'Edit User' });
    this.usernameInput = page.locator('#UserUsername');
    this.nameInput = page.locator('#UserName');
    this.emailInput = page.locator('#UserEmail');
    this.addressInput = page.locator('#UserAddress');
    this.employeeIdInput = page.locator('#employeeid');
    this.designationButton = multiselectButton(page, 'UserDesignationId');
    this.currentRole = page.locator('#editUserrole');
    this.editRoleLink = page.locator('#editRoleLink');
    this.roleButton = multiselectButton(page, 'UserRole');
    this.reportingToButton = multiselectButton(page, 'ReportingUser');
    // Not #changepwdlink: the app reuses that id for "Remove Picture & Location".
    this.changePasswordButton = page.locator('#formUserAdd').getByRole('link', { name: 'Change Password' });
    // :visible because each click on Change Password adds another copy of the dialog to the page.
    this.passwordDialog = page.locator('.ui-dialog:visible').filter({ hasText: 'Password Change' });
    this.newPasswordInput = this.passwordDialog.locator('#changepwd');
    this.confirmPasswordInput = this.passwordDialog.locator('#changepwdcnf');
    this.submitPasswordButton = this.passwordDialog.getByRole('button', { name: 'Change Password' });
    this.passwordTips = this.passwordDialog.locator('#validateTips');
    this.passwordRules = this.passwordDialog.locator('#password_strength');
    this.alertDialog = page.locator('.ui-dialog').filter({ has: page.locator('.alert') });
    this.activeCheckbox = page.locator('#UserActive');
    this.saveButton = page.locator('#addsubmit');
    this.imageUploadRow = page.locator('#imageUploadRow');
    this.imageUploadInput = page.locator('#imageUploadInput');
    this.uploadedImages = page.locator('#imageUploadContainer .uploaded-file');
    this.imageLimitMessage = page.locator('#imageLimitMessage');
    this.validationAlert = page.locator('.ui-dialog:visible').filter({ has: page.locator('.ui-dialog-title', { hasText: /^Alert$/ }) });
  }

  /** Clicks Edit Role: the Role dropdown and the role's mapping dropdowns (already filled in) appear. */
  async editRole() {
    await this.editRoleLink.click();
    await expect(this.roleButton).toBeVisible();
    await this.page.waitForLoadState('networkidle');
  }

  /** After Edit Role: picks another role and waits until its mapping dropdowns (empty) are loaded. */
  async selectRole(label: string) {
    // waitForLoadState('networkidle') returns at once on an idle page, so wait for the Ajax call itself.
    const mappingLoaded = this.page.waitForResponse((r) => r.url().includes('/users/getidsforrole/'));
    await pickInMultiselect(this.roleButton, label, { exact: true });
    await expect(this.roleButton).toHaveText(label);
    await mappingLoaded;
    await this.page.waitForLoadState('networkidle');
  }

  /** Label of the mapping dropdown "Select <field>" (e.g. 'ZONE') shown after Edit Role. */
  mappingLabel(field: string): Locator {
    return this.page.locator('#formUserAdd label').filter({ hasText: new RegExp(`^\\s*Select ${field}\\s*\\*?\\s*$`, 'i') });
  }

  /** After Edit Role: picks `option` in the mapping dropdown labelled "Select <field>" (e.g. 'ZONE'). */
  async selectMapping(field: string, option: string) {
    const label = this.mappingLabel(field);
    await expect(label, `"Select ${field}" dropdown`).toBeVisible({ timeout: 15_000 });
    const selectId = await label.first().evaluate((l) => l.parentElement!.querySelector('select')!.id);
    const button = multiselectButton(this.page, selectId);
    await pickInMultiselect(button, option);
    await expect(button).toContainText(option);
    await this.page.waitForLoadState('networkidle');
  }

  /** After Edit Role: picks the user's reporting manager (option text, e.g. "50 - E2E SALES MANAGER"). */
  async selectReportingTo(option: string) {
    await pickInMultiselect(this.reportingToButton, option);
    await expect(this.reportingToButton).toHaveText(option);
  }

  /** Opens the collapsed "User Attendance Verification Images" section. */
  async openImages() {
    const header = this.imageUploadRow.locator('.ui-accordion-header');
    await expect(header).toHaveText('User Attendance Verification Images');
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
    await expect(this.imageUploadRow.locator('.ui-accordion-content')).toBeVisible();
  }

  /** Uploads image files and waits until every one is stored (its URL is filled in). */
  async uploadImages(files: string[]) {
    const before = await this.uploadedImages.count();
    await this.imageUploadInput.setInputFiles(files);
    await expect(this.uploadedImages).toHaveCount(before + files.length, { timeout: 30_000 });
    for (let i = before; i < before + files.length; i++) {
      await expect(this.uploadedImages.nth(i).locator('input[type="hidden"]'), `image ${i + 1} stored`).not.toHaveValue('', { timeout: 30_000 });
    }
  }

  /** Clicks Save and waits for the users list (answers OK if the app asks for confirmation). */
  async save() {
    this.page.once('dialog', (d) => d.accept().catch(() => {}));
    await this.saveButton.click();
    await expect(this.page).toHaveURL(/\/users\/ajaxuserindex/, { timeout: 45_000 });
  }

  /** Clicks Save when it should be refused; returns the Alert text and closes it. */
  async saveExpectingAlert(): Promise<string> {
    await this.saveButton.click();
    await expect(this.validationAlert.first()).toBeVisible();
    const message = (await this.validationAlert.last().locator('.ui-dialog-content').innerText()).trim();
    while (await this.validationAlert.count()) {
      await this.validationAlert.last().getByRole('button', { name: 'Ok' }).click();
    }
    return message;
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
    const dialog = this.passwordDialog;
    // Like the user menu's Change Password: the link only opens the dialog once the page's scripts
    // are ready; clicked earlier it opens a bare page. Go back and try again then.
    await expect(async () => {
      if (this.page.url().includes('/users/changepwddialog')) await this.page.goBack();
      if (!(await dialog.count())) await this.changePasswordButton.click();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }

  /**
   * Change Password when the app refuses it (setting passwordresetlock): the page reloads with a
   * warning banner (`#warning_message`) instead of the dialog. Returns the banner.
   */
  async openChangePasswordRefused(): Promise<Locator> {
    const banner = this.page.locator('#warning_message');
    // Clicked before the page's scripts are ready, the link opens a bare page: go back and retry.
    await expect(async () => {
      if (this.page.url().includes('/users/changepwddialog')) await this.page.goBack();
      await this.changePasswordButton.click();
      await expect(banner).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 45_000 });
    await expect(this.passwordDialog).toHaveCount(0);
    return banner;
  }

  /** Types a new password (and its confirmation) in the open Password Change dialog. */
  async enterNewPassword(password: string, confirmation = password) {
    // Typed, not filled: the rule list under the field is updated on each key.
    await this.newPasswordInput.clear();
    await this.newPasswordInput.pressSequentially(password);
    await this.confirmPasswordInput.clear();
    await this.confirmPasswordInput.pressSequentially(confirmation);
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
