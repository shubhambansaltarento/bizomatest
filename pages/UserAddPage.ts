import { expect, type Dialog, type Locator, type Page } from '@playwright/test';
import type { MappingStep } from '../data/userRoles';

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
  /** The app's "Alert" dialog, used for every validation error. */
  readonly alertDialog: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.locator('legend').filter({ hasText: 'Add User' });
    this.usernameInput = page.locator('#UserUsername');
    this.passwordInput = page.locator('#UserPasswd');
    this.nameInput = page.locator('#UserName');
    this.usernameMessage = page.locator('#displaymsg #signal');
    this.roleSelect = page.locator('#UserRole');
    this.roleButton = this.multiselectButton('UserRole');
    this.addButton = page.locator('#addsubmit');
    this.alertDialog = page.locator('.ui-dialog').filter({ has: page.locator('.ui-dialog-title', { hasText: /^Alert$/ }) });
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
    await this.pickInMultiselect(this.roleButton, label, { exact: true });
    await expect(this.roleButton).toHaveText(label);
    await this.page.waitForLoadState('networkidle');
  }

  /** Fills the dropdowns a role must be mapped to, in order (see data/userRoles.ts). */
  async fillMapping(steps: readonly MappingStep[]) {
    for (const { field, option } of steps) {
      const button = await this.mappingButton(field);
      await this.pickInMultiselect(button, option);
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
        if (await this.alertDialog.isVisible()) {
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
    await expect(this.alertDialog).toBeVisible();
    const message = await this.alertMessage();
    await this.alertDialog.getByRole('button', { name: 'Ok' }).click();
    await expect(this.alertDialog).toBeHidden();
    return message;
  }

  private async alertMessage() {
    return (await this.alertDialog.locator('.ui-dialog-content').innerText()).trim();
  }

  /** Button of the mapping dropdown labelled "Select <field>" (with or without "*"). */
  private async mappingButton(field: string): Promise<Locator> {
    const label = this.page
      .locator('#formUserAdd label')
      .filter({ hasText: new RegExp(`^\\s*Select ${field}\\s*\\*?\\s*$`, 'i') });
    await expect(label, `"Select ${field}" dropdown`).toBeVisible({ timeout: 15_000 });
    // The select sits next to its label; it has no stable id across roles (e.g. ZONE is
    // #Rolespecificid for ZONE MANAGER but #zoneaddsalesman for the others).
    const selectId = await label.evaluate((l) => l.parentElement!.querySelector('select')!.id);
    return this.multiselectButton(selectId);
  }

  private multiselectButton(selectId: string): Locator {
    return this.page.locator(`#${selectId} ~ .btn-group > button.multiselect`);
  }

  /** Opens a bootstrap-multiselect dropdown, picks one option, and closes it again. */
  private async pickInMultiselect(button: Locator, text: string, { exact = false } = {}) {
    const menu = button.locator('xpath=following-sibling::*[contains(@class, "multiselect-container")]');
    const option = menu
      .locator('label')
      .filter({ hasText: exact ? new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`) : text })
      .first();
    // Options are loaded by Ajax; reopen until the wanted one is there.
    await expect(async () => {
      if (!(await menu.isVisible())) await button.click();
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await option.click();
    // Multi-select dropdowns stay open after a click; single-select ones close.
    if (await menu.isVisible()) await button.click();
    await expect(menu).toBeHidden();
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
