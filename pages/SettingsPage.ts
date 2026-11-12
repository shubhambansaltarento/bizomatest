import { expect, type Locator, type Page } from '@playwright/test';
import { multiselectButton, pickInMultiselect } from './multiselect';

/**
 * Settings → All Settings (/settings/allsettings): the company's configuration, one row per setting.
 *
 * "Default Settings" shows the company-wide value of every setting. "Role Wise Settings" shows a
 * role's values, or, with "For All Users" unticked, one user's values: settings whose Support Level
 * includes "User" can be overridden for a single user there.
 *
 * Saving is two steps: edit a value (checked on blur by POST /settings/validateSettings), click
 * Review (lists the changed settings), then Save. The app answers with an alert.
 */
export class SettingsPage {
  static readonly path = '/settings/allsettings';

  readonly heading: Locator;
  readonly reviewButton: Locator;
  readonly reviewPanel: Locator;
  /** The app's "Alert" dialog (it overrides window.alert). */
  readonly alertDialog: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'All Settings' });
    this.reviewButton = page.locator('#continueButton').getByRole('button', { name: 'Review' });
    this.reviewPanel = page.locator('#reviewsettingdiv');
    this.alertDialog = page.locator('.ui-dialog').filter({ has: page.locator('.ui-dialog-title', { hasText: /^Alert$/ }) });
  }

  async goto() {
    await this.page.goto(SettingsPage.path);
    await expect(this.heading).toBeVisible();
    await expect(this.companyValueInput('passwordresetlock')).toBeVisible({ timeout: 30_000 });
  }

  /** Company-wide value of a setting (Default Settings). */
  async companyValue(name: string): Promise<string> {
    return this.companyValueInput(name).inputValue();
  }

  /**
   * Sets a company-wide value and saves it. Returns the app's answer, or undefined if the setting
   * already had that value.
   */
  async setCompanyValue(name: string, value: string): Promise<string | undefined> {
    if ((await this.companyValue(name)) === value) return undefined;
    await this.enter(this.companyValueInput(name), value);
    return this.reviewAndSave(name);
  }

  /** One user's own value of a setting (Role Wise Settings → role → user). */
  async userValue(role: string, username: string, name: string): Promise<string> {
    await this.showUser(role, username);
    return this.userValueInput(name).inputValue();
  }

  /**
   * Overrides a setting for one user and saves it. Returns the app's answer, or undefined if the
   * user already had that value.
   */
  async setUserValue(role: string, username: string, name: string, value: string): Promise<string | undefined> {
    if ((await this.userValue(role, username, name)) === value) return undefined;
    await this.enter(this.userValueInput(name), value);
    return this.reviewAndSave(name);
  }

  private companyValueInput(name: string): Locator {
    return this.valueInput(this.page.locator('#comapanysettings'), name);
  }

  private userValueInput(name: string): Locator {
    return this.valueInput(this.page.locator('#userAndRoleSettingDiv'), name);
  }

  private valueInput(table: Locator, name: string): Locator {
    return table
      .locator('tr')
      .filter({ has: this.page.locator('td').getByText(name, { exact: true }) })
      .locator('input[type="text"]');
  }

  /** Role Wise Settings → pick the role → untick "For All Users" → pick the user. */
  private async showUser(role: string, username: string) {
    await this.goto();
    await pickInMultiselect(multiselectButton(this.page, 'setting'), 'Role Wise Settings', { exact: true });
    // Picking the role loads the role's values (…/getCurrentSetting/<role id>/role) into the same
    // table the user's values go to; wait for it, or it can land later and replace the user's table.
    await Promise.all([
      this.response(/^\/settings\/getCurrentSetting\/\d+\/role$/),
      pickInMultiselect(multiselectButton(this.page, 'settingValues'), role, { exact: true }),
    ]);
    const forAllUsers = this.page.locator('#allusersetting');
    await expect(forAllUsers).toBeChecked();
    await Promise.all([
      this.response(/^\/settings\/getUserAccordingRole\//),
      forAllUsers.uncheck(),
    ]);
    await Promise.all([
      this.response(/^\/settings\/getCurrentSetting\/\d+\/user$/),
      pickInMultiselect(multiselectButton(this.page, 'userNames'), username, { exact: true }),
    ]);
    await expect(this.userValueInput('passwordresetlock').or(this.userValueInput('initialPasswordReset')).first()).toBeVisible();
  }

  /** Waits for the answer to a request whose path matches (jQuery adds "?_=<time>" to some). */
  private response(path: RegExp) {
    return this.page.waitForResponse((r) => path.test(new URL(r.url()).pathname), { timeout: 30_000 });
  }

  /** Types a value and leaves the field; the app checks it on blur. */
  private async enter(input: Locator, value: string) {
    await input.fill(value);
    await Promise.all([
      this.response(/^\/settings\/validateSettings$/),
      input.blur(),
    ]);
    await expect(input).toHaveAttribute('data-valid', '1');
  }

  private async reviewAndSave(name: string): Promise<string> {
    await this.reviewButton.click();
    await expect(this.reviewPanel).toBeVisible();
    await expect(this.reviewPanel.locator('tr').filter({ hasText: name })).toBeVisible();
    await Promise.all([
      this.response(/^\/settings\/roleOrUserSettingSave\/?$/),
      this.reviewPanel.getByRole('button', { name: 'Save' }).click(),
    ]);
    await expect(this.alertDialog).toBeVisible();
    const message = (await this.alertDialog.locator('.ui-dialog-content').innerText()).trim();
    await this.alertDialog.getByRole('button', { name: 'Ok' }).click();
    return message;
  }
}
