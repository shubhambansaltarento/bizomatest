import { test, expect } from '../../fixtures/settings.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { createTestUser, deactivateTestUser } from '../../fixtures/testUsers';
import { userBlock, wrongAttempts } from '../../data/userBlock';

// Spec: specs/user-block/progressive-lockout.md. Run on its own: `npm run test:user-block`.
// Switches the company-wide Progressivelockout on; the appSettings fixture puts it back.
const spec = (...ids: string[]) => specFor('user-block/progressive-lockout', ...ids);

test.describe('User block: progressive lockout', () => {
  test(
    'UBLK-01..04 Wrong passwords block the user for longer and longer; after the block the user logs in',
    spec('UBLK-01', 'UBLK-02', 'UBLK-03', 'UBLK-04'),
    async ({ authedPage, appSettings, loginAs }) => {
      const attempts = wrongAttempts();
      const blocked = attempts >= userBlock.blockFrom;
      test.setTimeout((attempts + 6) * 60_000);
      test.info().annotations.push({ type: 'wrong passwords', description: `${attempts} (USER_BLOCK_ATTEMPTS)` });

      const user = await createTestUser(authedPage, { role: 'REPORT ADMIN' });
      try {
        await test.step('Switch Progressivelockout on (company-wide)', () => appSettings.setForCompany('Progressivelockout', '1'));

        let lastWrong = 0;
        for (let n = 1; n <= attempts; n++) {
          const id = n < userBlock.blockFrom ? 'UBLK-01' : 'UBLK-02';
          const message = n < userBlock.blockFrom ? userBlock.invalidMessage : userBlock.blockedFor(n);
          await test.step(`${id} Wrong password #${n}: "${message}"`, async () => {
            const { loginPage } = await loginAs(user.username, `Wrong@${n}x${Date.now().toString(36)}`);
            lastWrong = Date.now();
            await loginPage.expectVisible();
            await expect(loginPage.message(message)).toBeVisible();
          });
        }

        if (blocked) {
          await test.step(`UBLK-03 While blocked, the right password is refused`, async () => {
            const { loginPage } = await loginAs(user.username, user.password);
            await loginPage.expectVisible();
            await expect(loginPage.message(userBlock.stillBlocked(attempts))).toBeVisible();
          });

          await test.step(`Wait ${attempts} minutes for the block to run out`, async () => {
            const blockEnds = lastWrong + attempts * 60_000 + 20_000;
            await authedPage.waitForTimeout(Math.max(0, blockEnds - Date.now()));
          });
        } else {
          test.info().annotations.push({ type: 'not checked', description: `UBLK-02/03: no block with ${attempts} wrong passwords` });
        }

        await test.step('UBLK-04 The right password logs in', async () => {
          const { appShell } = await loginAs(user.username, user.password);
          await appShell.expectLoggedIn();
        });
      } finally {
        try {
          await test.step('Clean up: switch Progressivelockout back', () => appSettings.restoreNow());
        } finally {
          await deactivateTestUser(authedPage, user);
        }
      }
    },
  );
});
