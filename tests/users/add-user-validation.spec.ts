import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { addUserRoles, newUserData, type AddUserRoleLabel, type MappingStep } from '../../data/userRoles';
import { UsersListPage } from '../../pages/UsersListPage';
import { UserAddPage } from '../../pages/UserAddPage';

// Spec: specs/users/add-user-validation.md. Every case is rejected in the browser; nothing is saved.
const spec = (...ids: string[]) => specFor('users/add-user-validation', ...ids);

type Form = { username: string; password: string; name: string; role?: AddUserRoleLabel; mapping?: readonly MappingStep[] };

/** A valid form for a role with no mapping; each case breaks one thing. */
const validForm = (): Form => ({
  username: newUserData.username('validation'),
  password: newUserData.password,
  name: 'E2E Validation',
  role: 'REPORT ADMIN',
});

const roleMapping = (label: AddUserRoleLabel) => addUserRoles.find((r) => r.label === label)!.mapping;

const cases: { id: string; title: string; form: Partial<Form>; alert: string }[] = [
  { id: 'UVAL-01', title: 'username with a space and #', form: { username: `e2e bad#${Date.now()}` }, alert: 'Username contains illegal characters.' },
  { id: 'UVAL-02', title: 'empty name', form: { name: '' }, alert: 'Name is a mandatory field' },
  { id: 'UVAL-02', title: 'name of only spaces', form: { name: '   ' }, alert: 'Name is a mandatory field' },
  { id: 'UVAL-03', title: 'empty password', form: { password: '' }, alert: 'Please add User Password' },
  { id: 'UVAL-04', title: 'too short password', form: { password: 'abc' }, alert: 'Please Enter a Valid password' },
  { id: 'UVAL-04', title: 'password without a special character', form: { password: 'Web123123' }, alert: 'Please Enter a Valid password' },
  { id: 'UVAL-05', title: 'no role', form: { role: undefined }, alert: 'Please select a Role details.' },
  { id: 'UVAL-06', title: 'ZONE MANAGER without a zone', form: { role: 'ZONE MANAGER', mapping: [] }, alert: 'Please select a Role details.' },
  {
    id: 'UVAL-06',
    title: 'SALESMAN without an area',
    form: { role: 'SALESMAN', mapping: roleMapping('SALESMAN').filter((s) => s.field !== 'AREA') },
    alert: 'Please select a Role details.',
  },
];

test.describe('Add user validation', () => {
  for (const { id, title, form: change, alert } of cases) {
    test(`${id} Rejects ${title}`, spec(id, 'UVAL-07'), async ({ authedPage }) => {
      const addUser = new UserAddPage(authedPage);
      const form = { ...validForm(), ...change };

      await addUser.goto();
      await addUser.enterUsername(form.username);
      await addUser.expectUsernameAvailable();
      await addUser.fillDetails(form);
      if (form.role) await addUser.selectRole(form.role);
      if (form.mapping) await addUser.fillMapping(form.mapping);

      await test.step(`${id} Alert: "${alert}"`, async () => {
        expect(await addUser.submitExpectingAlert()).toBe(alert);
      });

      await test.step('UVAL-07 The form is not saved', async () => {
        await expect(authedPage).toHaveURL(/\/users\/add$/);
        await expect(addUser.usernameInput).toHaveValue(form.username);
        const usersList = new UsersListPage(authedPage);
        await usersList.goto();
        await usersList.search(form.username);
        expect(await usersList.columnValues('User Name')).not.toContain(form.username);
      });
    });
  }
});
