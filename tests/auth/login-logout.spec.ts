import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { env } from '../../config/env';
import { roles } from '../../data/roles';

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

  test('AUTH-09 Spaces around the username are ignored', spec('AUTH-09'), async ({ loginAs }) => {
    for (const [where, username] of [
      ['after', `${env.username}   `],
      ['before', `   ${env.username}`],
      ['on both sides', `  ${env.username}  `],
    ]) {
      await test.step(`Spaces ${where} the username`, async () => {
        // A separate browser per attempt, so each starts logged out.
        const { page, appShell } = await loginAs(username, env.password);
        await expect(page).toHaveURL(/\/users\/ajaxuserindex/);
        await appShell.expectLoggedInAs(roles.admin.label);
      });
    }
  });

  test('AUTH-10 Spaces around the password are ignored', spec('AUTH-10'), async ({ loginAs }) => {
    const { page, appShell } = await loginAs(env.username, `  ${env.password}  `);

    await expect(page).toHaveURL(/\/users\/ajaxuserindex/);
    await appShell.expectLoggedInAs(roles.admin.label);
  });

  test('AUTH-11 Login page offers Google sign-in', spec('AUTH-11'), async ({ loginPage }) => {
    // On dev google_signin is 1 and microsoft_signin is 0 (see the spec's settings table).
    await loginPage.goto();

    await expect(loginPage.orSeparator).toBeVisible();
    await expect(loginPage.googleSignIn).toBeVisible();
    // Not clicked: a real Google sign-in can't be automated (see the spec).
    const href = new URL((await loginPage.googleSignIn.getAttribute('href'))!);
    expect(`${href.origin}${href.pathname}`).toBe('https://accounts.google.com/o/oauth2/auth');
    expect(href.searchParams.get('response_type')).toBe('code');
    await expect(loginPage.microsoftSignIn).toHaveCount(0);
  });
});
