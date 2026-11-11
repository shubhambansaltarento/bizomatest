import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Set it in .env (see .env.example).`);
  }
  return value;
}

export const env = {
  baseURL: process.env.BASE_URL ?? '',
  loginPath: process.env.LOGIN_PATH ?? '/users/login',
  get username() {
    return required('BIZOM_USERNAME');
  },
  get password() {
    return required('BIZOM_PASSWORD');
  },
  /** Distributor manager account used by role-based UI tests. */
  get dmUsername() {
    return required('DM_USERNAME');
  },
  get dmNewPassword() {
    return required('DM_NEW_PASSWORD');
  },
  /**
   * Start of the passwords given to automation users (data/automationUsers.ts); digits are added per
   * run because the app refuses a user's last 3 passwords. Must hold an upper case letter, a lower
   * case letter and a special character, e.g. "Web@".
   */
  get e2ePasswordPrefix() {
    return required('E2E_USER_PASSWORD_PREFIX');
  },
};
