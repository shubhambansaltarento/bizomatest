import { test, expect } from '../../../fixtures/settings.fixture';
import { spec as specFor } from '../../../fixtures/spec';
import { UsersListPage } from '../../../pages/UsersListPage';

// Spec: specs/users/config/user-designation-column.md. Config test: run with `npm run test:users:config`.
const spec = (...ids: string[]) => specFor('users/config/user-designation-column', ...ids);

test.describe('Users list: Designation column with attendance_audit', () => {
  test.describe.configure({ timeout: 6 * 60_000 });

  test(
    'UDES-01 With attendance_audit off, Designation shows only the designation; UDES-02 also with it on',
    spec('UDES-01', 'UDES-02'),
    async ({ authedPage, appSettings, newTestUser }) => {
      const usersList = new UsersListPage(authedPage);
      const user = await newTestUser({ role: 'REPORT ADMIN', designation: 'DSM - DSM' });

      const designationShown = async () => {
        await usersList.goto();
        await usersList.search(user.username);
        expect(await usersList.columnValues('User Name')).toEqual([user.username]);
        return (await usersList.columnValues('Designation'))[0];
      };

      for (const [id, value] of [['UDES-01', '0'], ['UDES-02', '1']] as const) {
        await test.step(`${id} attendance_audit = ${value}: Designation is "DSM"`, async () => {
          await appSettings.setForUser('attendance_audit', user, value);
          expect(await designationShown()).toBe('DSM');
        });
      }
    },
  );
});
