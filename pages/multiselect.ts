import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The app draws most dropdowns with the bootstrap-multiselect plugin: the real <select> is hidden
 * and a button with a menu of labels is shown next to it.
 */
export function multiselectButton(page: Page, selectId: string): Locator {
  return page.locator(`#${selectId} ~ .btn-group > button.multiselect`);
}

/** Opens a bootstrap-multiselect dropdown, picks one option, and closes it again. */
export async function pickInMultiselect(button: Locator, text: string, { exact = false } = {}) {
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

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
