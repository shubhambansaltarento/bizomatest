import { expect, type Locator, type Page } from '@playwright/test';

/** User details at /users/view/<id>, opened by clicking a username in the users list. */
export class UserDetailsPage {
  readonly editButton: Locator;

  constructor(private readonly page: Page) {
    this.editButton = page.getByRole('link', { name: 'Edit', exact: true });
  }

  /** Clicks Edit, which opens the Edit page in a new tab; returns that tab. */
  async openEditInNewTab(): Promise<Page> {
    const [tab] = await Promise.all([this.page.context().waitForEvent('page'), this.editButton.click()]);
    await tab.waitForLoadState();
    return tab;
  }

  async expectLoadedFor(user: { id: string }) {
    await expect(this.page).toHaveURL(new RegExp(`/users/view/${user.id}$`));
    await expect(this.editButton).toHaveAttribute('href', new RegExp(`/users/edit/${user.id}$`));
  }
}
