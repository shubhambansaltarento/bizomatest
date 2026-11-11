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

  /** Column headers, in order. */
  static readonly columns = [
    'User ID',
    'User Name',
    'Name',
    'Employee ID',
    'Designation',
    'Phone Number',
    'Status',
    'Role',
    'For',
    'ZONE',
    'Actions',
  ];

  readonly heading: Locator;
  readonly table: Locator;
  readonly headers: Locator;
  readonly rows: Locator;
  readonly pageSizeSelect: Locator;
  readonly summary: Locator;
  readonly searchInput: Locator;
  readonly newUserButton: Locator;
  readonly downloadButton: Locator;
  /** "Active Users / Inactive Users / All Users" filter above the table. */
  readonly statusFilter: Record<'active' | 'inactive' | 'all', Locator>;
  readonly activeCount: Locator;
  readonly inactiveCount: Locator;
  /** Message shown after a save, e.g. "User added successfully". Hides itself after ~5 s. */
  readonly flashMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Users', exact: true });
    this.table = page.locator('#usertable');
    this.headers = this.table.locator('thead th');
    this.rows = this.table.locator('tbody tr');
    // aria-controls works in DataTables 1 and 2 (the 2.x upgrade in Oct 2026 dropped name="usertable_length").
    this.pageSizeSelect = page.locator('select[aria-controls="usertable"]');
    this.summary = page.locator('#usertable_info');
    this.searchInput = page.locator('input[type="search"][aria-controls="usertable"]');
    this.newUserButton = page.getByRole('link', { name: 'New User', exact: true });
    this.downloadButton = page.locator('#userdownloadcsv');
    this.statusFilter = {
      active: page.locator('#activeusersid'),
      inactive: page.locator('#inactiveusersid'),
      all: page.locator('#allusersid'),
    };
    this.activeCount = page.getByText(/^Active Count : \d+$/);
    this.inactiveCount = page.getByText(/^Inactive Count : \d+$/);
    this.flashMessage = page.locator('#flash-message');
  }

  async goto() {
    await this.page.goto(UsersListPage.path);
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/users\/ajaxuserindex/);
    await expect(this.heading).toBeVisible();
    await expect(this.table).toBeVisible();
    // Rows come from an Ajax call after the page loads.
    await expect(this.summary).toHaveText(/Showing \d+ to \d+ of \d+ entr(y|ies)/);
  }

  /** Pagination button: 'First' | 'Previous' | 'Next' | 'Last' or a page number. */
  pageButton(name: string) {
    return this.page.locator('#usertable_paginate button').filter({ hasText: new RegExp(`^${name}$`) });
  }

  async goToPage(name: string) {
    const before = await this.summary.innerText();
    await this.pageButton(name).click();
    await expect(this.summary).not.toHaveText(before);
  }

  async expectPageButtonEnabled(name: string, enabled: boolean) {
    if (enabled) await expect(this.pageButton(name)).not.toHaveAttribute('aria-disabled', 'true');
    else await expect(this.pageButton(name)).toHaveAttribute('aria-disabled', 'true');
  }

  /** Numbers in "Active Count : N" and "Inactive Count : N". */
  async statusCounts() {
    const number = async (l: Locator) => Number((await l.innerText()).match(/\d+/)![0]);
    return { active: await number(this.activeCount), inactive: await number(this.inactiveCount) };
  }

  async showStatus(status: 'active' | 'inactive' | 'all') {
    await this.redraw(() => this.statusFilter[status].check());
  }

  /** Types in the table's Search box and waits for the filtered rows. */
  async search(text: string) {
    await this.redraw(() => this.searchInput.fill(text));
  }

  /** Clicks a column header to sort by it; returns the new sort direction. */
  async sortBy(column: string) {
    const header = this.headers.filter({ hasText: new RegExp(`^${column}$`) });
    await this.redraw(() => header.click());
    return header.getAttribute('aria-sort');
  }

  /**
   * Runs an action that reloads the rows from the server (POST /users/ajaxuserlist) and waits until
   * the table shows them: DataTables redraws up to a second or two after the response arrives.
   */
  private async redraw(action: () => Promise<unknown>) {
    const snapshot = () => this.table.locator('tbody').innerText().then(async (rows) => rows + (await this.summary.innerText()));
    const before = await snapshot();
    await Promise.all([this.page.waitForResponse((r) => r.url().includes('/users/ajaxuserlist')), action()]);
    await expect.poll(snapshot, { message: 'users table redrawn' }).not.toBe(before);
  }

  /** Text of one column for every visible row. */
  async columnValues(column: string): Promise<string[]> {
    const index = UsersListPage.columns.indexOf(column);
    return this.rows.evaluateAll(
      (rows, i) => rows.map((r) => (r.querySelectorAll('td')[i] as HTMLElement | undefined)?.innerText.trim() ?? ''),
      index,
    );
  }

  /** Action links of a row: Edit, map marker (location view), and Pjp when the user has one. */
  rowActions(row: Locator) {
    const actions = row.locator('.actions');
    return {
      edit: actions.getByRole('link', { name: 'Edit' }),
      map: actions.locator('a[href^="/users/usermapview/"]'),
      pjp: actions.getByRole('link', { name: 'Pjp' }),
    };
  }

  /** Parses "Showing 1 to 10 of 23 entries". */
  async readSummary() {
    await expect(this.summary).toHaveText(/Showing \d+ to \d+ of \d+ entr(y|ies)/);
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

  /** Clicks the username in its row, which opens the user's details page. */
  async openDetails(username: string) {
    await this.rows.getByRole('link', { name: username, exact: true }).click();
  }

  async clickEdit(user: UserRow) {
    await user.row.getByRole('link', { name: 'Edit' }).click();
  }
}
