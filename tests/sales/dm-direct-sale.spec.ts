import { test, expect } from '../../fixtures/auth.fixture';
import { spec } from '../../fixtures/spec';
import { env } from '../../config/env';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserEditPage } from '../../pages/UserEditPage';
import { SalePage } from '../../pages/SalePage';

// Spec: specs/sales/dm-direct-sale.md
// One journey: each criterion builds on the previous one, so they run as steps of one test.
test(
  'SALE-01..07 Admin resets a distributor manager password → DM logs in → direct sale is created',
  spec('sales/dm-direct-sale', 'SALE-01', 'SALE-02', 'SALE-03', 'SALE-04', 'SALE-05', 'SALE-06', 'SALE-07'),
  async ({ authedPage: page, loginPage, appShell }) => {
    test.slow();
    const usersList = new UsersListPage(page);
    const editPage = new UserEditPage(page);
    const salePage = new SalePage(page);
    const note = (type: string, description: string) => test.info().annotations.push({ type, description });

    const username = await test.step('SALE-01 Admin picks a random distributor manager', async () => {
      await usersList.goto();
      const { total } = await usersList.readSummary();
      await usersList.setPageSize(100);
      await usersList.expectPageSize(100, total);

      const dm = await usersList.pickRandomUser({
        where: (u) => u.role === 'DISTRIBUTOR MANAGER' && u.mappedTo !== '',
      });
      note('distributor manager', `${dm.username} (ID ${dm.id}), mapped to: ${dm.mappedTo}`);

      await usersList.clickEdit(dm);
      await editPage.expectLoadedFor(dm);
      return dm.username;
    });

    await test.step('SALE-02 Admin changes the distributor manager password', async () => {
      await editPage.openChangePassword();
      await editPage.changePassword(env.dmNewPassword);
    });

    await test.step('SALE-03 Distributor manager logs in with the new password', async () => {
      await appShell.logout();
      await loginPage.expectVisible();
      await loginPage.login(username, env.dmNewPassword);
      await appShell.expectLoggedInAs('DISTRIBUTOR MANAGER');
    });

    const items = await test.step('SALE-04 Step 1: buyer selected and items listed', async () => {
      await salePage.goto();
      const warehouse = await salePage.chooseWarehouseWithStockIfAsked();
      if (warehouse) note('warehouse', warehouse);

      const buyers = await salePage.buyers();
      expect(buyers.length, 'buyers to choose from').toBeGreaterThan(0);
      const buyer = buyers[Math.floor(Math.random() * buyers.length)];
      note('buyer', buyer);

      await salePage.selectBuyer(buyer);
      const items = await salePage.itemNames();
      expect(items.length, 'items in the order table').toBeGreaterThan(0);
      return { buyer, names: items };
    });

    await test.step('SALE-05 Step 2: every item is added with 1 case', async () => {
      await salePage.enterCasesForEveryItem(1);
      await salePage.next();
      await expect(salePage.step2).toBeVisible();
      // Rows are drawn shortly after the step opens, so poll.
      await expect
        .poll(() => salePage.stepItems(salePage.step2))
        .toEqual(items.names.map((name) => ({ name, cases: 1 })));
    });

    await test.step('SALE-06 Step 3: summary is shown', async () => {
      await salePage.next();
      await expect(salePage.step3).toBeVisible();
      await expect(salePage.step3).toContainText(items.buyer);
      await salePage.ensurePaymentMode('Cash');
      await expect(salePage.finishButton).not.toHaveClass(/buttonDisabled/);
    });

    await test.step('SALE-07 Finish creates the sale', async () => {
      const result = await salePage.finish();
      expect(result, `sale rejected: ${result.Reason}`).toMatchObject({ Result: true });
      expect(result.data?.invoiceid, 'invoice ID').toBeTruthy();
      note('invoice ID', `${result.data!.invoiceid} (payment ${result.data!.paymentId})`);

      await expect(salePage.step1).toBeVisible();
      await expect(salePage.finishButton).toHaveClass(/buttonDisabled/);
    });
  },
);
