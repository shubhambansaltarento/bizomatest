/**
 * App settings that config tests change. They live on Settings → All Settings
 * (`/settings/allsettings`), which only an ADMIN can open. Change them in tests only through the
 * `appSettings` fixture (fixtures/settings.fixture.ts): it edits them there as admin
 * (edit → Review → Save) and puts the original values back after the test.
 *
 * `level` is where the app lets a setting be changed:
 * - 'company': only for the whole company (Default Settings). Affects everyone on the server while
 *   it is changed, so tests using it run on their own (`npm run test:config`).
 * - 'user': can also be set for one user (Role Wise Settings → role → untick For All Users → user).
 *   Prefer this: only that (automation) user is affected.
 *
 * `devValue` is the value seen on dev (devarun) on 11 Nov 2026, for reference only: the fixture
 * always reads the current value before changing it.
 */
export type SettingLevel = 'company' | 'user';

export const appSettings = {
  passwordresetlock: {
    level: 'company',
    devValue: '0',
    about: 'Blocks a password reset for 24 hours after a password change',
  },
  forceLogoutOnPasswordChange: {
    level: 'company',
    devValue: '0',
    about: 'Logs the user out when their password is changed',
  },
  changepasswordnotification: {
    level: 'company',
    devValue: '{"enable": 0,"alert_days": [14,7,5,3,1]}',
    about: 'Alert on login n days before the password expires (see password_ageing_days)',
  },
  initialPasswordReset: {
    level: 'user',
    devValue: '0',
    about: 'Asks the user to reset their password on first login',
  },
  password_ageing_days: {
    level: 'user',
    devValue: '0',
    about: "Forces a password reset after n days (0 = off)",
  },
  requiredPasswordLoginMinutes: {
    level: 'user',
    devValue: '0',
    about: '"Used in APP only": asks for the password again after n minutes',
  },
  google_signin: {
    level: 'user',
    devValue: '1',
    about: 'Shows Google sign-in (the app applies it company-wide only)',
  },
  microsoft_signin: {
    level: 'user',
    devValue: '0',
    about: 'Microsoft sign-in (1) or Microsoft SAML SSO (2)',
  },
  twofactorauth: {
    level: 'user',
    devValue: '0',
    about: '0 none, 1 SMS, 2 email, 3 both, 4 authenticator app (TOTP)',
  },
  attendanceimage: {
    level: 'user',
    devValue: '0',
    about: 'Requires a photo when marking attendance',
  },
} as const satisfies Record<string, { level: SettingLevel; devValue: string; about: string }>;

export type SettingName = keyof typeof appSettings;
