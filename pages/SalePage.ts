import { expect, type Locator, type Page } from '@playwright/test';

export type SaleResult = { Result: boolean; Reason: string; data?: { invoiceid?: string; paymentId?: number } };

/** Direct-sale wizard at /payments/sale (Step 1 Account Details → Step 2 Added SKUs → Step 3 Summary). */
export class SalePage {
  static readonly path = '/payments/sale';

  readonly nextButton: Locator;
  readonly finishButton: Locator;
  readonly step1: Locator;
  readonly step2: Locator;
  readonly step3: Locator;

  /** "Please select depo first" prompt, shown to users mapped to several warehouses. */
  readonly warehousePrompt: Locator;
  readonly warehouseSelect: Locator;

  readonly allOutletsFilter: Locator;
  readonly buyerSelect: Locator;
  readonly buyerDropdown: Locator;
  readonly orderTable: Locator;
  /** Item rows of the order table (excludes the "No data available" row). */
  readonly orderRows: Locator;
  readonly orderTableLength: Locator;

  readonly paymentModeSelect: Locator;
  /** Bootstrap-multiselect button the app draws over the hidden #PaymentMode select. */
  readonly paymentModeButton: Locator;

  constructor(private readonly page: Page) {
    // Wizard controls are links, not buttons.
    this.nextButton = page.locator('a.buttonNext');
    this.finishButton = page.locator('a.buttonFinish');
    this.step1 = page.locator('#step-1');
    this.step2 = page.locator('#step-2');
    this.step3 = page.locator('#step-3');

    this.warehousePrompt = page.locator('.ui-dialog').filter({ hasText: 'Please select depo first' });
    this.warehouseSelect = page.locator('#warehouseId');

    this.allOutletsFilter = page.locator('#allouts');
    this.buyerSelect = page.locator('#outletId');
    this.buyerDropdown = page.locator('[aria-labelledby="select2-outletId-container"]');
    this.orderTable = page.locator('#skunitstable');
    this.orderRows = this.orderTable.locator('tbody tr').filter({ has: page.locator('input[id^="cases_"]') });
    this.orderTableLength = page.locator('select[name="skunitstable_length"]');

    this.paymentModeSelect = page.locator('#PaymentMode');
    this.paymentModeButton = page.locator('#PaymentMode ~ .btn-group > button.multiselect');
  }

  async goto() {
    await this.page.goto(SalePage.path);
    await expect(this.step1).toBeVisible();
    // Step 1 is filled in after load: either the buyer picker or the warehouse prompt appears.
    await expect(this.buyerDropdown.or(this.warehousePrompt)).toBeVisible();
  }

  private async selectWarehouse(value: string) {
    await this.warehouseSelect.selectOption(value);
    await expect(this.warehousePrompt).toBeHidden();
    await this.page.waitForLoadState('networkidle');
  }

  async buyers(): Promise<string[]> {
    // Buyers are loaded a moment after Step 1 appears; some warehouses have none at all.
    await this.buyerSelect
      .locator('option:nth-child(2)')
      .waitFor({ state: 'attached', timeout: 10_000 })
      .catch(() => {});
    return this.buyerSelect.locator('option').evaluateAll((options) =>
      options.filter((o) => (o as HTMLOptionElement).value).map((o) => o.textContent!.trim()),
    );
  }

  async selectBuyer(name: string) {
    await this.allOutletsFilter.check();
    await this.buyerDropdown.click();
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/skunits/getSKUnitsData/')),
      this.page.locator('.select2-results__option').filter({ hasText: name }).first().click(),
    ]);
    await this.page.waitForLoadState('networkidle');
    await this.showAllItems();
  }

  /** The order table shows 10 items per page; switch to 100 only when some are hidden. */
  private async showAllItems() {
    const info = this.page.locator('#skunitstable_info');
    if (!(await info.isVisible())) return;
    const [, to, total] = (await info.innerText()).match(/to (\d+) of (\d+)/) ?? [];
    if (to === total) return;
    await this.orderTableLength.selectOption('100');
    await expect(info).toHaveText(new RegExp(`to ${total} of ${total}`));
  }

  /** Available cases per listed item. */
  async availableCases(): Promise<number[]> {
    return this.orderRows.evaluateAll((rows) =>
      rows.map((r) => Number(r.querySelector('[id^="casesavai_"]')?.textContent?.trim() || 0)),
    );
  }

  async itemNames(): Promise<string[]> {
    return this.orderRows.evaluateAll((rows) =>
      rows.map((r) => r.querySelector('[id^="skuname_"] > div')?.textContent?.trim() ?? ''),
    );
  }

  /**
   * If the warehouse prompt is shown, picks the first warehouse that has buyers and at least
   * 1 case in stock for every item. Returns the warehouse name, or undefined when there was no prompt.
   */
  async chooseWarehouseWithStockIfAsked(): Promise<string | undefined> {
    if (!(await this.warehousePrompt.isVisible())) return undefined;

    const warehouses = await this.warehouseSelect.locator('option').evaluateAll((options) =>
      options
        .filter((o) => (o as HTMLOptionElement).value)
        .map((o) => ({ value: (o as HTMLOptionElement).value, name: o.textContent!.trim() })),
    );
    for (const warehouse of warehouses) {
      await this.goto();
      await this.selectWarehouse(warehouse.value);
      const [firstBuyer] = await this.buyers();
      if (!firstBuyer) continue;
      await this.selectBuyer(firstBuyer);
      const stock = await this.availableCases();
      if (stock.length && stock.every((cases) => cases >= 1)) {
        // Start clean on this warehouse; the caller selects its own buyer.
        await this.goto();
        await this.selectWarehouse(warehouse.value);
        return warehouse.name;
      }
    }
    throw new Error(`No warehouse has buyers and stock for every item: ${warehouses.map((w) => w.name).join(', ')}`);
  }

  async enterCasesForEveryItem(cases: number) {
    const inputs = this.orderRows.locator('input[id^="cases_"]');
    // The table can still be redrawn by late responses, which wipes typed values; re-enter until they stick.
    await expect(async () => {
      for (const input of await inputs.all()) {
        if ((await input.inputValue()) === String(cases)) continue;
        await input.fill(String(cases));
        await input.dispatchEvent('change'); // the app adds the item on "change"
      }
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(500);
      expect(await inputs.evaluateAll((es) => es.map((e) => (e as HTMLInputElement).value))).toEqual(
        Array(await inputs.count()).fill(String(cases)),
      );
    }).toPass({ timeout: 20_000 });
  }

  async next() {
    await this.nextButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Rows of a step's item table, as { name, cases }, without the Total / Rounded rows. */
  async stepItems(step: Locator) {
    const rows = await step
      .locator('table')
      .filter({ hasText: 'Sku Name' })
      .first()
      .locator('tbody tr')
      .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim())));
    return rows
      .filter((cells) => cells.length > 1 && !/^(Total|Rounded Amount)$/.test(cells[0]))
      .map((cells) => ({ name: cells[0], cases: Number(cells[1]) }));
  }

  /** Payment Mode on Step 3. Its default depends on the buyer and can be empty. */
  async ensurePaymentMode(label: 'Cash' | 'Credit' | 'Cheque' | 'Online') {
    const current = await this.paymentModeSelect.evaluate((s: HTMLSelectElement) => s.selectedOptions[0]?.text.trim());
    if (current === label) return;
    await this.paymentModeButton.click();
    await this.page.locator('#PaymentMode ~ .btn-group').locator(`label[title="${label}"]`).click();
    await expect(this.paymentModeButton).toHaveText(label);
  }

  /** Clicks Finish and returns the server's JSON answer (the page reloads right after). */
  async finish(): Promise<SaleResult> {
    // A validation problem shows a browser alert instead of sending the sale; surface it.
    const alerts: string[] = [];
    const onDialog = (d: import('@playwright/test').Dialog) => {
      alerts.push(d.message());
      d.dismiss().catch(() => {});
    };
    this.page.on('dialog', onDialog);
    let result: SaleResult | undefined;
    await this.page.route(`**${SalePage.path}`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const response = await route.fetch();
      result = JSON.parse((await response.text()).trim());
      await route.fulfill({ response });
    });
    try {
      await Promise.all([
        this.page.waitForResponse((r) => r.url().endsWith(SalePage.path) && r.request().method() === 'POST', {
          timeout: 30_000,
        }),
        this.finishButton.click(),
      ]);
    } catch (error) {
      if (alerts.length) throw new Error(`Finish did not submit the sale. App alert: ${alerts.join(' | ')}`);
      throw error;
    } finally {
      this.page.off('dialog', onDialog);
      await this.page.unroute(`**${SalePage.path}`);
    }
    await this.page.waitForLoadState('networkidle');
    expect(result, 'sale response').toBeDefined();
    return result!;
  }
}
