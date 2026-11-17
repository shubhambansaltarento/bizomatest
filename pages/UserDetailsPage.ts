import { expect, type Locator, type Page } from '@playwright/test';

/** User details at /users/view/<id>, opened by clicking a username in the users list. */
export class UserDetailsPage {
  readonly editButton: Locator;
  /** "Home" in the page's own side menu: goes to /users/details/<id>, which shows this page again. */
  readonly homeLink: Locator;
  /** "Last Login Date Time : <yyyy-mm-dd hh:mm:ss>" (empty when never recorded). */
  readonly loginDetails: Locator;
  /** "Last Logout Time : <yyyy-mm-dd hh:mm>" ("N/A" when never recorded). */
  readonly logoutDetails: Locator;

  constructor(private readonly page: Page) {
    this.editButton = page.getByRole('link', { name: 'Edit', exact: true });
    this.homeLink = page.locator('a#home');
    this.loginDetails = this.field('Login Details');
    this.logoutDetails = this.field('Logout Details');
  }

  /** Clicks Edit, which opens the Edit page in a new tab; returns that tab. */
  async openEditInNewTab(): Promise<Page> {
    const [tab] = await Promise.all([this.page.context().waitForEvent('page'), this.editButton.click()]);
    await tab.waitForLoadState();
    return tab;
  }

  async goto(id: string) {
    await this.page.goto(`/users/view/${id}`);
    await expect(this.editButton).toBeVisible();
  }

  /** Value cell of a row in the details table, e.g. field('Email'). */
  field(name: string): Locator {
    return this.page
      .locator('tr')
      .filter({ has: this.page.locator('td:first-child').getByText(name, { exact: true }) })
      .locator('td')
      .nth(1);
  }

  async expectLoadedFor(user: { id: string }) {
    await expect(this.page).toHaveURL(new RegExp(`/users/view/${user.id}$`));
    await expect(this.editButton).toHaveAttribute('href', new RegExp(`/users/edit/${user.id}$`));
  }
}
