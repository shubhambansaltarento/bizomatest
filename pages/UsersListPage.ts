import { expect, type Locator, type Page } from '@playwright/test';

export type UserRow = {
  id: string;
  username: string;
  role: string;
  /** Distributors / warehouses the user is mapped to ("For" column); empty when unmapped. */
  mappedTo: string;
  row: Locator;
};

/** Users list at /users/ajaxuserindex (a DataTables table). */
export class UsersListPage {
  static readonly path = '/users/ajaxuserindex';

  readonly table: Locator;
  readonly rows: Locator;
  readonly pageSizeSelect: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    this.table = page.locator('#usertable');
    this.rows = this.table.locator('tbody tr');
    // aria-controls works in DataTables 1 and 2 (the 2.x upgrade in Oct 2026 dropped name="usertable_length").
    this.pageSizeSelect = page.locator('select[aria-controls="usertable"]');
    this.summary = page.locator('#usertable_info');
  }

  async goto() {
    await this.page.goto(UsersListPage.path);
    await expect(this.table).toBeVisible();
  }

  /** Parses "Showing 1 to 10 of 23 entries". */
  async readSummary() {
    await expect(this.summary).toHaveText(/Showing \d+ to \d+ of \d+ entries/);
    const [, from, to, total] = (await this.summary.innerText()).match(/Showing (\d+) to (\d+) of (\d+)/)!;
    return { from: Number(from), to: Number(to), total: Number(total) };
  }

  async setPageSize(size: 10 | 25 | 50 | 100) {
    await this.pageSizeSelect.selectOption(String(size));
  }

  async expectPageSize(size: number, total: number) {
    const expected = Math.min(size, total);
    await expect(this.pageSizeSelect).toHaveValue(String(size));
    await expect(this.rows).toHaveCount(expected);
    await expect(this.summary).toHaveText(`Showing 1 to ${expected} of ${total} entries`);
  }

  async visibleUsers(): Promise<UserRow[]> {
    const count = await this.rows.count();
    const users: UserRow[] = [];
    for (let i = 0; i < count; i++) {
      const row = this.rows.nth(i);
      const [id, username, role, mappedTo] = await row.locator('td').evaluateAll((cells) => {
        const text = (c: Element | null | undefined) => (c as HTMLElement | null)?.innerText.trim() ?? '';
        // Columns: User ID, User Name, Name, Employee ID, Designation, Phone, Status, Role, For, ...
        return [text(cells[0]), text(cells[1]), text(cells[7]), cells[8]?.querySelector('.Ashowmore')?.textContent?.trim() ?? ''];
      });
      users.push({ id, username, role, mappedTo, row });
    }
    return users;
  }

  async pickRandomUser({
    exclude = [] as string[],
    where = (_: UserRow) => true,
  } = {}): Promise<UserRow> {
    const candidates = (await this.visibleUsers()).filter((u) => !exclude.includes(u.username) && where(u));
    expect(candidates.length, 'at least one user to pick').toBeGreaterThan(0);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async clickEdit(user: UserRow) {
    await user.row.getByRole('link', { name: 'Edit' }).click();
  }
}
