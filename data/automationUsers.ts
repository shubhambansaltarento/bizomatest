import { env } from '../config/env';
import type { AddUserRoleLabel } from './userRoles';

/**
 * AUTOMATION USERS: read this before touching any user whose username starts with "e2e.".
 *
 * Every user whose username starts with `e2e.` was created by this test suite. They are not real
 * people: tests set and change their passwords, deactivate and reactivate them, and create new ones
 * on every run. Don't use them for manual testing or give them to anyone, and don't be surprised
 * when their password or status changes.
 *
 * - `automationUsers`: one fixed account per role, reused by the user lifecycle tests
 *   (tests/users/user-lifecycle.spec.ts: login, password change, deactivate / reactivate).
 * - `createdByEarlierRuns`: other e2e users already on devarun (now inactive). UADD-03
 *   (tests/users/add-user.spec.ts) adds one more per role on every run, named `e2e.<role>.<unique
 *   suffix>`, and deactivates it at the end; those are not listed here.
 * - `npm run cleanup:e2e-users` deactivates every active e2e user except `automationUsers`, e.g. after
 *   an interrupted run.
 *
 * Passwords are never stored: each run makes new ones with `freshPassword()` (prefix from .env).
 * The accounts below exist on devarun (BASE_URL in .env.example), created 10 Nov 2026.
 */
export const automationUserPrefix = 'e2e.';

export type WebLogin =
  /** Logs in to the web app. */
  | { result: 'allowed'; /** Page seen right after login. Not asserted yet (see TODO.md). */ landingPath: string }
  /** The app refuses web logins for this role, with this message, even with the right password. */
  | { result: 'refused'; message: string; note: string }
  /** Should log in but doesn't: tested as an expected failure until fixed. */
  | { result: 'knownIssue'; issue: string };

export type AutomationUser = {
  role: AddUserRoleLabel;
  id: string;
  username: string;
  name: string;
  webLogin: WebLogin;
};

export const automationUsers: AutomationUser[] = [
  { role: 'ADMIN', id: '47', username: 'e2e.admin.mwakrblf', name: 'E2E ADMIN', webLogin: { result: 'allowed', landingPath: '/users/ajaxuserindex' } },
  { role: 'ZONE MANAGER', id: '48', username: 'e2e.zonemanager.mwakrrh9', name: 'E2E ZONE MANAGER', webLogin: { result: 'allowed', landingPath: '/users/ajaxuserindex' } },
  { role: 'WAREHOUSE MANAGER', id: '49', username: 'e2e.warehousemanager.mwaks7dt', name: 'E2E WAREHOUSE MANAGER', webLogin: { result: 'allowed', landingPath: '/users/ajaxuserindex' } },
  { role: 'SALES MANAGER', id: '50', username: 'e2e.salesmanager.mwaksl2h', name: 'E2E SALES MANAGER', webLogin: { result: 'allowed', landingPath: '/users/ajaxuserindex' } },
  {
    role: 'SALESMAN',
    id: '51',
    username: 'e2e.salesman.mwakswz3',
    name: 'E2E SALESMAN',
    webLogin: {
      result: 'refused',
      message: 'Invalid request url.',
      note: 'SALESMAN web login is refused, also for the existing Raghav.Salesman (10 Nov 2026); presumably mobile-app only. Awaiting product confirmation.',
    },
  },
  { role: 'DISTRIBUTOR MANAGER', id: '52', username: 'e2e.distributormanager.mwaktc1y', name: 'E2E DISTRIBUTOR MANAGER', webLogin: { result: 'allowed', landingPath: '/users/ajaxuserindex' } },
  { role: 'DISTRIBUTOR SALESMAN', id: '53', username: 'e2e.distributorsalesman.mwaktpfe', name: 'E2E DISTRIBUTOR SALESMAN', webLogin: { result: 'allowed', landingPath: '/payments/sale/order' } },
  { role: 'DISTRIBUTOR SALES MANAGER', id: '54', username: 'e2e.distributorsalesmanager.mwaku2l8', name: 'E2E DISTRIBUTOR SALES MANAGER', webLogin: { result: 'allowed', landingPath: '/users/dashboard' } },
  { role: 'REPORT ADMIN', id: '55', username: 'e2e.reportadmin.mwakuh3g', name: 'E2E REPORT ADMIN', webLogin: { result: 'allowed', landingPath: '/users/dashboard' } },
  { role: 'EXECUTION AUDITOR', id: '56', username: 'e2e.executionauditor.mwakusj1', name: 'E2E EXECUTION AUDITOR', webLogin: { result: 'allowed', landingPath: '/activities/tagger' } },
  { role: 'INVENTORY MANAGER', id: '57', username: 'e2e.inventorymanager.mwakv6ql', name: 'E2E INVENTORY MANAGER', webLogin: { result: 'allowed', landingPath: '/inventories/alertlevel' } },
  { role: 'VENDOR', id: '58', username: 'e2e.vendor.mwakvhh6', name: 'E2E VENDOR', webLogin: { result: 'allowed', landingPath: '/users/dashboard' } },
  {
    role: 'ERP API User',
    id: '59',
    username: 'e2e.erpapiuser.mwakvv34',
    name: 'E2E ERP API User',
    webLogin: {
      result: 'knownIssue',
      issue: 'Login loops between /users/dashboard and /users/customroledashboard until the browser stops (ERR_TOO_MANY_REDIRECTS), 10 Nov 2026',
    },
  },
];

/** Other e2e users on devarun, from the first runs of UADD-03 and from exploring the Add User form. */
export const createdByEarlierRuns: { id: string; username: string }[] = [
  { id: '31', username: 'e2e.reportadmin.016752' },
  { id: '32', username: 'e2e.salesman.024805' },
  { id: '33', username: 'e2e.admin.mwakjeq7' },
  { id: '34', username: 'e2e.zonemanager.mwakji7a' },
  { id: '35', username: 'e2e.warehousemanager.mwakka73' },
  { id: '36', username: 'e2e.salesmanager.mwakk6q1' },
  { id: '37', username: 'e2e.distributormanager.mwakl389' },
  { id: '38', username: 'e2e.salesman.mwakl1nz' },
  { id: '39', username: 'e2e.distributorsalesmanager.mwakluot' },
  { id: '40', username: 'e2e.distributorsalesman.mwaklvg3' },
  { id: '41', username: 'e2e.reportadmin.mwakmmhm' },
  { id: '42', username: 'e2e.executionauditor.mwakmrd3' },
  { id: '43', username: 'e2e.inventorymanager.mwakner7' },
  { id: '44', username: 'e2e.vendor.mwaknmwi' },
  { id: '45', username: 'e2e.erpapiuser.mwako5l0' },
  { id: '46', username: 'e2e.reportadmin.probemwakpki9' },
];

let passwordCounter = 0;
/**
 * A password no automation user has had before: the app refuses any of a user's last 3 passwords,
 * so tests can't reset to a fixed one. Prefix from .env (E2E_USER_PASSWORD_PREFIX) + digits.
 */
export const freshPassword = () =>
  `${env.e2ePasswordPrefix}${Date.now().toString().slice(-7)}${process.pid % 100}${passwordCounter++}`;

export const isAutomationUser = (username: string) => username.startsWith(automationUserPrefix);
