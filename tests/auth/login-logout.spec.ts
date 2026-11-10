import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';

// Spec: specs/auth/login-logout.md — one test per acceptance criterion.
const spec = (id: string) => specFor('auth/login-logout', id);

test.describe('Login & Logout', () => {
  test('AUTH-01 Valid user can log in', spec('AUTH-01'), async ({ page, loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.login();

    await expect(page).toHaveURL(/\/users\/ajaxuserindex/);
    await appShell.expectLoggedIn();
    // asserstion --  RBAC - login success diff screen
    // data managements -- with automation
  });

  test('AUTH-02 Logged-in user can log out', spec('AUTH-02'), async ({ page, loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.login();
    await appShell.expectLoggedIn();

    await appShell.logout();

    await expect(page).toHaveURL(/\/users\/login$/);
    await loginPage.expectVisible();
  });

  test('AUTH-03 Wrong password is rejected', spec('AUTH-03'), async ({ loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.login(undefined, `wrong-${Date.now()}`);

    await loginPage.expectVisible();
    await expect(loginPage.errorMessage('Invalid User credentials')).toBeVisible();
    await expect(appShell.userMenuToggle).toHaveCount(0);
  });

  test('AUTH-04 Unknown username is rejected', spec('AUTH-04'), async ({ loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.login(`no-such-user-${Date.now()}`, 'any-password');

    await loginPage.expectVisible();
    await expect(loginPage.errorMessage('Invalid username or password.')).toBeVisible();
    await expect(appShell.userMenuToggle).toHaveCount(0);
  });

  test('AUTH-05 Empty form does not log in', spec('AUTH-05'), async ({ loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.submitButton.click();

    await loginPage.expectVisible();
    await expect(appShell.userMenuToggle).toHaveCount(0);
  });

  test('AUTH-06 Protected page requires login', spec('AUTH-06'), async ({ page, loginPage }) => {
    await page.goto('/users/ajaxuserindex');

    // Since 22 Oct 2026 the app no longer adds ?redirect=… (see the note under AUTH-06 in the spec).
    await expect(page).toHaveURL(/\/users\/login(\?|$)/);
    await loginPage.expectVisible();
  });

  test('AUTH-07 Session ends on logout', spec('AUTH-07'), async ({ page, loginPage, appShell }) => {
    await loginPage.goto();
    await loginPage.login();
    await appShell.expectLoggedIn();
    await appShell.logout();
    await loginPage.expectVisible();

    await test.step('Back button does not restore the session', async () => {
      await page.goBack();
      await loginPage.expectVisible();
    });

    await test.step('Opening a protected page redirects to login', async () => {
      await page.goto('/users/ajaxuserindex');
      await loginPage.expectVisible();
    });
  });

  test(
    'AUTH-08 Logged-in user opening the login page goes to the dashboard',
    spec('AUTH-08'),
    async ({ authedPage }) => {
      await authedPage.goto('/users/login');

      await expect(authedPage).toHaveURL(/\/users\/dashboard/);
    },
  );
});
