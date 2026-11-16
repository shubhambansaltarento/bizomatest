import { expect, type Dialog, type Locator, type Page } from '@playwright/test';
import type { MappingStep } from '../data/userRoles';
import { multiselectButton, pickInMultiselect } from './multiselect';

/**
 * Add User form at /users/add (Users list → New User).
 *
 * The Role dropdown and the Add button stay hidden until the username has been checked on blur
 * (POST /users/checkusername) and found free. Picking a role then adds the dropdowns that role must
 * be mapped to (ZONE → Subzone → WAREHOUSE / DISTRIBUTOR → AREA), each loaded after the previous one.
 * Validation errors are shown in a jQuery UI "Alert" dialog (the app overrides window.alert); the
 * "continue without a reporting manager?" question is a native browser confirm.
 */
export class UserAddPage {
  static readonly path = '/users/add';

  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly nameInput: Locator;
  /** "User name is Available" (green) or "User name is not Available. …" (red), under Username. */
  readonly usernameMessage: Locator;
  readonly roleSelect: Locator;
  /** Button the bootstrap-multiselect plugin draws over the hidden Role select. */
  readonly roleButton: Locator;
  readonly addButton: Locator;
  /** The app's "Alert" dialog, used for every validation error. Several can be open at once. */
  readonly alertDialog: Locator;
  /** Red / green password rule list under Password, updated on each key press ("1 Digit Needed, …"). */
  readonly passwordStrength: Locator;
  /** Phone number, typed without the dial code (the +91 country picker is separate). */
  readonly phoneInput: Locator;
  /** "✓ Valid" (green), shown when the phone field is left with a valid number. */
  readonly phoneValidMessage: Locator;
  /** "Invalid number" (red), shown when the phone field is left with an invalid number. */
  readonly phoneErrorMessage: Locator;
  readonly emailInput: Locator;
  readonly gmailInput: Locator;
  readonly addressInput: Locator;
  readonly imeiInput: Locator;
  readonly employeeIdInput: Locator;
  readonly designationSelect: Locator;
  readonly designationButton: Locator;
  /** Read-only; filled by the calendar that opens on click (value YYYY-MM-DD). */
  readonly dateOfBirthInput: Locator;
  /** Month view of the open date of birth calendar. */
  readonly calendar: Locator;
  /** Red/green banner at the top after the server refuses the form (e.g. "Username already taken, …"). */
  readonly flashMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.locator('.fieldset-heading').filter({ hasText: 'Add User' });
    this.usernameInput = page.locator('#UserUsername');
    this.passwordInput = page.locator('#UserPasswd');
    this.nameInput = page.locator('#UserName');
    this.usernameMessage = page.locator('#displaymsg #signal');
    this.roleSelect = page.locator('#UserRole');
    this.roleButton = multiselectButton(page, 'UserRole');
    this.addButton = page.locator('#addsubmit');
    this.alertDialog = page.locator('.ui-dialog:visible').filter({ has: page.locator('.ui-dialog-title', { hasText: /^Alert$/ }) });
    this.passwordStrength = page.locator('#password_strength');
    this.phoneInput = page.locator('#libphonenumberId');
    this.phoneValidMessage = page.locator('#valid-msg');
    this.phoneErrorMessage = page.locator('#error-msg');
    this.emailInput = page.locator('#UserEmail');
    this.gmailInput = page.locator('#UserGmailId');
    this.addressInput = page.locator('#UserAddress');
    this.imeiInput = page.locator('#UserImei');
    this.employeeIdInput = page.locator('#employeeid');
    this.designationSelect = page.locator('#UserDesignationId');
    this.designationButton = multiselectButton(page, 'UserDesignationId');
    this.dateOfBirthInput = page.locator('#dateofbirth');
    // The single-date picker still draws an empty right-hand calendar; the month is on the left.
    this.calendar = page.locator('.daterangepicker:visible .drp-calendar.left');
    this.flashMessage = page.locator('#flash-message, #flash_message');
  }

  /** Free-text fields that must be empty on a new form (username, password, name and the optional ones). */
  textFields(): Record<string, Locator> {
    return {
      Username: this.usernameInput,
      Password: this.passwordInput,
      Name: this.nameInput,
      'Phone No.': this.phoneInput,
      Email: this.emailInput,
      'Gmail ID': this.gmailInput,
      Address: this.addressInput,
      IMEI: this.imeiInput,
      'Employee Id': this.employeeIdInput,
      'Date of Birth': this.dateOfBirthInput,
    };
  }

  async goto() {
    await this.page.goto(UserAddPage.path);
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/users\/add$/);
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.nameInput).toBeVisible();
  }

  /** Types a username and leaves the field, which makes the app check whether it is free. */
  async enterUsername(username: string) {
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/users/checkusername')),
      this.usernameInput.fill(username).then(() => this.usernameInput.blur()),
    ]);
  }

  async expectUsernameAvailable() {
    await expect(this.usernameMessage).toHaveText('User name is Available');
    await expect(this.roleButton).toBeVisible();
    await expect(this.addButton).toBeVisible();
  }

  async expectUsernameTaken() {
    await expect(this.usernameMessage).toHaveText('User name is not Available. Please Try Again with different Username.');
    await expect(this.roleButton).toBeHidden();
    await expect(this.addButton).toBeHidden();
  }

  /** Role names offered in the Role dropdown, without the "Please select a role" placeholder. */
  async roleOptions(): Promise<string[]> {
    return this.roleSelect
      .locator('option')
      .evaluateAll((options) => options.filter((o) => (o as HTMLOptionElement).value).map((o) => o.textContent!.trim()));
  }

  async selectRole(label: string) {
    await pickInMultiselect(this.roleButton, label, { exact: true });
    await expect(this.roleButton).toHaveText(label);
    await this.page.waitForLoadState('networkidle');
  }

  /** Fills the dropdowns a role must be mapped to, in order (see data/userRoles.ts). */
  async fillMapping(steps: readonly MappingStep[]) {
    for (const { field, option } of steps) {
      const button = await this.mappingButton(field);
      await pickInMultiselect(button, option);
      await expect(button).toContainText(option);
      // The next dropdown is built from an Ajax answer to this choice.
      await this.page.waitForLoadState('networkidle');
    }
  }

  async fillDetails({ password, name }: { password: string; name: string }) {
    // An empty password means the user never typed in the field (typing then clearing it gives a
    // different message). The password rule is checked on keyup, which fill() doesn't send.
    if (password) {
      await this.passwordInput.fill(password);
      await this.passwordInput.press('End');
    }
    await this.nameInput.fill(name);
  }

  /**
   * Clicks Add and waits for the users list. Accepts the "continue without a reporting manager?"
   * confirmation; if the app shows an Alert instead, the form was rejected and its text is thrown.
   */
  async submit() {
    const acceptConfirm = (d: Dialog) => {
      if (d.type() === 'confirm') d.accept().catch(() => {});
    };
    this.page.on('dialog', acceptConfirm);
    try {
      await this.addButton.click();
      await expect(async () => {
        if (await this.alertDialog.count()) {
          throw new Error(`Add User was rejected. App alert: ${await this.alertMessage()}`);
        }
        await expect(this.page).toHaveURL(/\/users\/ajaxuserindex/, { timeout: 1_000 });
      }).toPass({ timeout: 45_000 });
    } finally {
      this.page.off('dialog', acceptConfirm);
    }
  }

  /** Clicks Add when the form is expected to be rejected; returns the Alert text and closes it. */
  async submitExpectingAlert(): Promise<string> {
    await this.addButton.click();
    await expect(this.alertDialog.first()).toBeVisible();
    const messages = await this.closeAlerts();
    // Several checks can fire at once; the last one opened is on top.
    return messages[messages.length - 1];
  }

  /** Closes every open Alert, top one first; returns their texts in the order they were opened. */
  async closeAlerts(): Promise<string[]> {
    const messages = (await this.alertDialog.locator('.ui-dialog-content').allInnerTexts()).map((t) => t.trim());
    while (await this.alertDialog.count()) {
      await this.alertDialog.last().getByRole('button', { name: 'Ok' }).click();
    }
    return messages;
  }

  private async alertMessage() {
    return (await this.alertDialog.last().locator('.ui-dialog-content').innerText()).trim();
  }

  /** Types a password key by key (the rule list under the field updates on keyup). */
  async typePassword(password: string) {
    await this.passwordInput.fill('');
    await this.passwordInput.pressSequentially(password);
    // Clearing the field sends no keyup of its own.
    if (!password) await this.passwordInput.press('Backspace');
  }

  /** Types a phone number and leaves the field, which validates it. */
  async enterPhone(number: string) {
    await this.phoneInput.fill(number);
    await this.phoneInput.blur();
  }

  /** Option texts of the Designation dropdown, without the "Select Designation ..." placeholder. */
  async designationOptions(): Promise<string[]> {
    return this.designationSelect
      .locator('option')
      .evaluateAll((options) => options.filter((o) => (o as HTMLOptionElement).value !== '0' && (o as HTMLOptionElement).value !== '').map((o) => o.textContent!.trim()));
  }

  async selectDesignation(label: string) {
    await pickInMultiselect(this.designationButton, label, { exact: true });
    await expect(this.designationButton).toHaveText(label);
  }

  async openCalendar() {
    await this.dateOfBirthInput.click();
    await expect(this.calendar).toBeVisible();
  }

  /** Picks a date in the open date of birth calendar. `month` is 1–12. */
  async pickDate({ year, month, day }: { year: number; month: number; day: number }) {
    await this.calendar.locator('.yearselect').selectOption(String(year));
    await this.calendar.locator('.monthselect').selectOption(String(month - 1));
    await this.dayCell(day).click();
  }

  /** Day cell of the shown month (not the greyed days of the months before and after). */
  dayCell(day: number): Locator {
    return this.calendar.locator('td:not(.off), td.disabled:not(.ends)').filter({ hasText: new RegExp(`^${day}$`) }).first();
  }

  /** Label of the mapping dropdown "Select <field>" (with or without "*"). */
  mappingLabel(field: string): Locator {
    return this.page.locator('#formUserAdd label').filter({ hasText: new RegExp(`^\\s*Select ${field}\\s*\\*?\\s*$`, 'i') });
  }

  /** Button of the mapping dropdown labelled "Select <field>" (with or without "*"). */
  private async mappingButton(field: string): Promise<Locator> {
    const label = this.mappingLabel(field);
    await expect(label, `"Select ${field}" dropdown`).toBeVisible({ timeout: 15_000 });
    // The select sits next to its label; it has no stable id across roles (e.g. ZONE is
    // #Rolespecificid for ZONE MANAGER but #zoneaddsalesman for the others).
    const selectId = await label.evaluate((l) => l.parentElement!.querySelector('select')!.id);
    return multiselectButton(this.page, selectId);
  }
}

