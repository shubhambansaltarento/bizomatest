/**
 * User module: the ONE mapping between the QA sheet and the code.
 *
 * QA sheet: docs/TestCases_11-11-26-07_45_22.csv (module AD_Users, 111 cases, exported 11 Nov 2026).
 * Every case of the sheet is listed here exactly once, and says either
 * - `coveredBy`: the spec criterion IDs (specs/**.md, `### <ID>`) whose tests cover it, or
 * - `todo` / `blocker` / `notCovered`: why there is no test yet.
 *
 * What uses it:
 * - fixtures/spec.ts tags every test with the sheet cases of its criteria (`@TC8981`), so
 *   `npx playwright test --grep @TC8981` runs the tests of one sheet case, and the HTML report shows them.
 * - `npm run coverage:users` checks this file against the sheet, the specs and the real test list, and
 *   writes docs/user-module/user-module-test-coverage.xlsx. It fails when a link is broken.
 *
 * Status in the Excel sheet is worked out, not typed in:
 * - Covered:     `coveredBy` criteria all have tests. A test marked `test.fail` (known app bug) still
 *                counts as covered; the Excel shows "Known app bug" with the reason from the code.
 * - Partial:     covered, but `gap` says what part of the case is not tested.
 * - Blocker:     `blocker` here, or a linked test is `test.fixme` (reason taken from the code).
 * - TODO:        `todo`: could be automated on devarun, not done yet.
 * - Not covered: `notCovered`: out of scope for the web suite (API, mobile app, other module).
 *
 * Do not write statuses anywhere else. To change one, change the test (fail / fixme) or this file.
 * Pure data, no imports: Node reads it directly (scripts/user-coverage.mjs).
 */

/** Part of the user module, matching the spec folders (specs/users, specs/user-creation, specs/user-block). */
export type Area =
  | 'User creation'
  | 'Users list'
  | 'User details'
  | 'Edit user'
  | 'Password & status'
  | 'User block'
  | 'User form settings';

export type OutOfScope = 'API' | 'Mobile app' | 'Other module';

type CaseInfo = {
  /** Case code in the sheet. */
  tc: string;
  /** What the case checks, in our words (sheet titles are often unclear or "NA"). */
  about: string;
  /** Client / environment the sheet wrote it for; we run it on devarun (BASE_URL). */
  client?: string;
  /** App setting the case depends on (see data/settings.ts). */
  setting?: string;
  /** Where the sheet disagrees with the app or with itself. */
  mismatch?: string;
};

export type Gap = {
  /** What is left of the case, and why it is not tested. */
  note: string;
  /** What kind of work is left. */
  remaining: 'TODO' | 'Blocker' | 'Out of scope';
};

export type SheetCase = CaseInfo &
  (
    | { area: Area; coveredBy: string[]; gap?: Gap }
    | { area: Area; todo: string }
    | { area: Area; blocker: string }
    | { area: OutOfScope; notCovered: string }
  );

const parked = 'Other module: parked in TODO-later-user-module.md';

export const userModuleCases: SheetCase[] = [
  // ───────────────────────── User creation (specs/user-creation) ─────────────────────────
  { tc: 'TC8980', area: 'User creation', about: 'New User opens the Add User page', coveredBy: ['UFORM-01', 'ULIST-08'] },
  { tc: 'TC8998', area: 'User creation', about: 'Add User form opens blank, also right after saving a user (bug 130313)', coveredBy: ['UFORM-01'] },
  { tc: 'TC8981', area: 'User creation', about: 'A blank username is refused', coveredBy: ['UFORM-03'] },
  { tc: 'TC9003', area: 'User creation', about: 'A taken username is refused', coveredBy: ['UADD-01'] },
  { tc: 'TC9004', area: 'User creation', about: 'Username with letters, digits and @ . _ is available', coveredBy: ['UFORM-02'] },
  {
    tc: 'TC9005',
    area: 'User creation',
    about: 'A name another user already has is accepted',
    coveredBy: ['UFORM-04'],
    mismatch: 'Sheet title says "existing password", but its steps and expected result are about the Name field.',
  },
  { tc: 'TC8983', area: 'User creation', about: 'Password is mandatory', coveredBy: ['UVAL-03'] },
  { tc: 'TC8984', area: 'User creation', about: 'The password rule list shows what is missing', coveredBy: ['UFORM-05', 'UVAL-04'] },
  {
    tc: 'TC8982',
    area: 'User creation',
    about: 'Role is mandatory',
    coveredBy: ['UVAL-05'],
    mismatch: 'Sheet says "Please select role details."; the app says "Please select a Role details."',
  },
  {
    tc: 'TC9437',
    area: 'User creation',
    about: 'Add is refused when the role mapping cannot load',
    coveredBy: ['UFORM-12'],
    client: 'RB',
    mismatch: 'Sheet title is "NA"; the description here comes from its steps.',
  },
  { tc: 'TC9011', area: 'User creation', about: 'Zone appears after the role, Subzone after the zone', coveredBy: ['UFORM-11'] },
  {
    tc: 'TC9012',
    area: 'User creation',
    about: 'Distributor appears after Subzone, Area after Distributor',
    coveredBy: ['UFORM-11'],
    mismatch: 'Sheet title mentions Reporting To, but its steps do not.',
  },
  { tc: 'TC9006', area: 'User creation', about: 'An 8-digit phone number is invalid', coveredBy: ['UFORM-06'] },
  { tc: 'TC9007', area: 'User creation', about: 'A 10-digit phone number is valid', coveredBy: ['UFORM-07'] },
  { tc: 'TC9008', area: 'User creation', about: 'Designation can be picked, before and after picking a role', coveredBy: ['UFORM-08'] },
  {
    tc: 'TC9009',
    area: 'User creation',
    about: 'Date of birth is picked from a calendar',
    coveredBy: ['UFORM-09'],
    mismatch: 'Sheet says dd-mm-yyyy; the app shows and saves YYYY-MM-DD.',
  },
  { tc: 'TC9010', area: 'User creation', about: 'Date of birth cannot be in the future', coveredBy: ['UFORM-10'] },
  {
    tc: 'TC9442',
    area: 'User creation',
    about: 'User custom fields keep their configured order on Add, View and Edit',
    coveredBy: ['UFORM-13'],
    client: 'Swastiks',
  },
  {
    tc: 'TC9443',
    area: 'User creation',
    about: 'After re-ordering the custom fields, Add, View and Edit show the new order',
    coveredBy: ['UFORM-13'],
    client: 'Swastiks',
    mismatch: 'Sheet gives it the same title as TC9442.',
  },
  { tc: 'TC8985', area: 'User creation', about: 'Admin creates a user; "User added successfully" shows', coveredBy: ['UADD-03'] },
  { tc: 'TC9433', area: 'User creation', about: 'A user can be created', coveredBy: ['UADD-03'], client: 'BAT' },
  { tc: 'TC9436', area: 'User creation', about: 'Creating a user with all mandatory fields gives no 500', coveredBy: ['UADD-03'], client: 'RB' },
  { tc: 'TC9495', area: 'User creation', about: 'A new user is added without errors and is in the list', coveredBy: ['UADD-03'], client: 'Laravel dev' },
  { tc: 'TC9504', area: 'User creation', about: 'No 5xx when adding a user', coveredBy: ['UADD-03'], client: 'Laravel dev' },
  { tc: 'TC8995', area: 'User creation', about: 'A newly created user can log in on the web', coveredBy: ['UFORM-14'] },
  {
    tc: 'TC9524',
    area: 'User creation',
    about: '3 attendance verification images save without 5xx',
    coveredBy: ['UIMG-01', 'UIMG-02', 'UIMG-03'],
    client: 'Laravel dev',
    setting: 'attendanceFaceVerification = 1',
  },
  {
    tc: 'TC9531',
    area: 'User creation',
    about: 'Uploading attendance verification images gives no 5xx',
    coveredBy: ['UIMG-03'],
    client: 'Laravel dev',
    setting: 'attendanceFaceVerification = 1',
  },
  {
    tc: 'TC9537',
    area: 'User creation',
    about: '3 images are saved and still shown after reload',
    coveredBy: ['UIMG-03'],
    client: 'Laravel dev',
    setting: 'attendanceFaceVerification = 1',
  },
  {
    tc: 'TC9532',
    area: 'User creation',
    about: 'After 5 images a 6th cannot be added',
    coveredBy: ['UIMG-04', 'UIMG-05'],
    client: 'Laravel dev',
    setting: 'attendanceFaceVerification = 1',
  },

  // ───────────────────────── Users list (specs/users/users-list.md, config/user-designation-column.md) ─────────────────────────
  { tc: 'TC8979', area: 'Users list', about: '/users and /users/dashboard open', coveredBy: ['ULIST-11'] },
  { tc: 'TC8986', area: 'Users list', about: 'Map (location) icon in the Actions column opens the user map', coveredBy: ['ULIST-06'] },
  { tc: 'TC8987', area: 'Users list', about: 'Pjp icon in the Actions column opens the user\'s PJP', coveredBy: ['ULIST-06'] },
  { tc: 'TC8988', area: 'Users list', about: 'Search filters the list by username / name / user id', coveredBy: ['ULIST-04'] },
  { tc: 'TC8989', area: 'Users list', about: 'Download gives the users of the chosen status filter', coveredBy: ['ULIST-07', 'ULIST-09'] },
  { tc: 'TC8992', area: 'Users list', about: 'Active Users filter shows only active users', coveredBy: ['ULIST-02'] },
  {
    tc: 'TC8993',
    area: 'Users list',
    about: 'Inactive Users filter shows only inactive users',
    coveredBy: ['ULIST-02'],
    mismatch: 'Sheet title says "active users"; its steps choose "Inactive users".',
  },
  { tc: 'TC8994', area: 'Users list', about: 'All Users filter shows active and inactive users', coveredBy: ['ULIST-02'] },
  {
    tc: 'TC8999',
    area: 'Users list',
    about: 'Active user count on the page matches the downloaded file',
    coveredBy: ['ULIST-02', 'ULIST-09'],
    mismatch: 'Users are counted by ID: the file has one row per mapping, so rows ≠ users.',
  },
  {
    tc: 'TC9449',
    area: 'Users list',
    about: 'Active user count on the portal matches the report, also after a status change',
    coveredBy: ['ULIST-09'],
    client: 'Polycab',
    gap: { remaining: 'TODO', note: 'Change a user\'s status, then compare the count and the download again. "UI report" read as the users list Download.' },
  },
  {
    tc: 'TC9450',
    area: 'Users list',
    about: 'Report with no active users, and during concurrent user updates',
    client: 'Polycab',
    blocker: 'Needs a company with no active users and two sessions changing users at once; not possible on the shared devarun company.',
  },
  { tc: 'TC9507', area: 'Users list', about: 'The Users page loads with its list and controls', coveredBy: ['ULIST-01'], client: 'Laravel dev' },
  {
    tc: 'TC9508',
    area: 'Users list',
    about: 'Users page with a large data set shows no errors',
    coveredBy: ['ULIST-01', 'ULIST-03'],
    client: 'Laravel dev',
    gap: { remaining: 'Blocker', note: 'Needs a company with a large number of users; devarun has few.' },
  },
  { tc: 'TC9561', area: 'Users list', about: 'No DataTables warning when /users loads and is searched', coveredBy: ['ULIST-04', 'ULIST-10'], client: 'RB' },
  { tc: 'TC9562', area: 'Users list', about: 'Table reloads without warnings on search and clear', coveredBy: ['ULIST-04', 'ULIST-10'], client: 'RB' },
  {
    tc: 'TC10931',
    area: 'Users list',
    about: 'attendance_audit off: Designation column shows only the designation',
    coveredBy: ['UDES-01'],
    setting: 'attendance_audit = 0',
  },
  {
    tc: 'TC10932',
    area: 'Users list',
    about: 'attendance_audit on: Designation column still shows only the designation',
    coveredBy: ['UDES-02'],
    setting: 'attendance_audit = 1',
  },

  // ───────────────────────── User details (specs/users/user-details.md) ─────────────────────────
  { tc: 'TC9013', area: 'User details', about: 'Clicking a username opens the user view page', coveredBy: ['UVIEW-01'] },
  { tc: 'TC9516', area: 'User details', about: 'User view page loads without errors; Home works', coveredBy: ['UVIEW-02'], client: 'Laravel dev' },
  { tc: 'TC9521', area: 'User details', about: 'No 5xx on the user view page, also on reload, for two users', coveredBy: ['UVIEW-02'], client: 'Laravel dev' },
  {
    tc: 'TC9000',
    area: 'User details',
    about: 'Activities Report on the user view page shows the lat / long of the latest order call',
    todo: 'Needs a salesman with an order call (orderadd) for the chosen date; check whether a web sale by a DM (SALE-07) shows in the report.',
  },
  { tc: 'TC10592', area: 'User details', about: 'Last web login time is updated in Login Details', coveredBy: ['UVIEW-03'], client: 'Custom branch' },
  { tc: 'TC10593', area: 'User details', about: 'Last web logout time is updated in Login Details', coveredBy: ['UVIEW-04'], client: 'Custom branch' },

  // ───────────────────────── Edit user (specs/users/edit-user.md) ─────────────────────────
  {
    tc: 'TC8991',
    area: 'Edit user',
    about: 'Edit changes the user\'s details and role',
    coveredBy: ['UEDIT-01', 'UEDIT-02', 'UEDIT-05'],
    mismatch: 'Sheet says the username is changed; on the web it is read-only on Edit. Only the role part is tested (UEDIT-05).',
  },
  { tc: 'TC8997', area: 'Edit user', about: 'Edit page shows the Edit User heading and form; changes save', coveredBy: ['UEDIT-01', 'UEDIT-02'] },
  { tc: 'TC9001', area: 'Edit user', about: 'Email can be changed on Edit', coveredBy: ['UEDIT-02', 'UEDIT-03'] },
  {
    tc: 'TC9431',
    area: 'Edit user',
    about: 'Reporting To of a distributor sales manager is filled in and kept after Save',
    coveredBy: ['UEDIT-06'],
    client: 'TGI',
    mismatch: 'Sheet repeats the check for a second DSM; the test checks one.',
  },
  { tc: 'TC9439', area: 'Edit user', about: 'A user can be edited and the changes are kept', coveredBy: ['UEDIT-02'], client: 'GCPL' },
  { tc: 'TC9444', area: 'Edit user', about: 'Changes to an existing user (e.g. email) are saved', coveredBy: ['UEDIT-02'], client: 'BAT' },
  { tc: 'TC9445', area: 'Edit user', about: 'Invalid or missing details are refused on Save', coveredBy: ['UEDIT-03', 'UEDIT-04'], client: 'BAT' },
  { tc: 'TC9505', area: 'Edit user', about: 'Details and role are edited and saved without errors', coveredBy: ['UEDIT-05'], client: 'Laravel dev' },
  { tc: 'TC9506', area: 'Edit user', about: 'An incomplete role selection is refused without a 5xx', coveredBy: ['UEDIT-05'], client: 'Laravel dev' },

  // ───────────────────────── Password & status (specs/users/user-lifecycle.md, user-password-status.md) ─────────────────────────
  { tc: 'TC8990', area: 'Password & status', about: 'Admin inactivates a user from Edit', coveredBy: ['ULIFE-05'] },
  { tc: 'TC10611', area: 'Password & status', about: 'A user is inactivated without errors and shows as Inactive', coveredBy: ['ULIFE-05'] },
  {
    tc: 'TC9002',
    area: 'Password & status',
    about: 'An inactive user cannot log in on the web',
    coveredBy: ['UPST-03'],
    mismatch: 'Sheet expects an "inactive user" message; the web shows "Invalid username or password."',
  },
  { tc: 'TC9477', area: 'Password & status', about: 'Admin changes a user\'s password; success message shows', coveredBy: ['ULIFE-01'], client: 'RB' },
  {
    tc: 'TC9478',
    area: 'Password & status',
    about: 'Admin changes a DM\'s password; the DM logs in with it',
    coveredBy: ['SALE-02', 'SALE-03'],
    client: 'RB',
  },
  { tc: 'TC9511', area: 'Password & status', about: 'Admin changes a password; the user logs in with the new one', coveredBy: ['ULIFE-01', 'ULIFE-02'], client: 'Laravel dev' },
  {
    tc: 'TC9512',
    area: 'Password & status',
    about: 'An invalid password is refused in Change Password',
    coveredBy: ['UPST-02'],
    client: 'Laravel dev',
    mismatch: 'Sheet expects "Please enter valid password!"; the web shows "Password Not Valid".',
  },
  {
    tc: 'TC10612',
    area: 'Password & status',
    about: 'Inactivating a user with duplicate IDs in the managed list gives no error',
    blocker: 'Steps unclear: how to get duplicate ID entries in the managed list. Ask QA.',
  },
  {
    tc: 'TC10613',
    area: 'Password & status',
    about: 'Change Password pop-up loads for a user without a role',
    coveredBy: ['UPST-01'],
    gap: { remaining: 'Blocker', note: 'Checked on a user with a role; the web does not allow a user without a role.' },
  },
  {
    tc: 'TC10614',
    area: 'Password & status',
    about: 'Change Password pop-up shows no errors for a user without a role',
    coveredBy: ['UPST-01'],
    gap: { remaining: 'Blocker', note: 'Checked on a user with a role; the web does not allow a user without a role.' },
  },

  // ───────────────────────── User block (specs/user-block/progressive-lockout.md) ─────────────────────────
  { tc: 'TC10597', area: 'User block', about: '1st wrong password: "Invalid User Credentials.."', coveredBy: ['UBLK-01'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10598', area: 'User block', about: '2nd wrong password: "Invalid User Credentials.."', coveredBy: ['UBLK-01'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10599', area: 'User block', about: '3rd wrong password: blocked for 3 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10600', area: 'User block', about: '4th wrong password: blocked for 4 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10601', area: 'User block', about: '5th wrong password: blocked for 5 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10602', area: 'User block', about: '6th wrong password: blocked for 6 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10603', area: 'User block', about: '7th wrong password: blocked for 7 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10604', area: 'User block', about: '8th wrong password: blocked for 8 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  { tc: 'TC10605', area: 'User block', about: '9th wrong password: blocked for 9 minutes', coveredBy: ['UBLK-02'], setting: 'Progressivelockout = 1' },
  {
    tc: 'TC10606',
    area: 'User block',
    about: '10th wrong password: blocked for good',
    setting: 'Progressivelockout = 1',
    blocker: 'Blocks the user for good, so an admin must Unblock (TC10595, needs `unblockuser`). Left out on purpose: USER_BLOCK_ATTEMPTS is at most 9.',
  },
  {
    tc: 'TC10595',
    area: 'User block',
    about: 'Admin / reporting manager unblocks a user blocked by progressive lockout',
    setting: 'Progressivelockout = 1, unblockuser',
    blocker: 'Needs a user blocked for good (10th wrong password, TC10606) and the `unblockuser` setting. Left out on purpose.',
  },
  {
    tc: 'TC10607',
    area: 'User block',
    about: 'Right password after 9 wrong ones (block run out) logs in',
    coveredBy: ['UBLK-04'],
    setting: 'Progressivelockout = 1',
    gap: { remaining: 'Out of scope', note: 'Web only; the mobile app part is not covered.' },
  },
  {
    tc: 'TC10608',
    area: 'User block',
    about: 'With Progressivelockout off, valid credentials log in on web and app',
    coveredBy: ['AUTH-01'],
    setting: 'Progressivelockout = 0',
    gap: { remaining: 'Out of scope', note: 'Web login only (Progressivelockout is off on devarun by default); the mobile app part is not covered.' },
  },
  {
    tc: 'TC10609',
    area: 'User block',
    about: 'With Progressivelockout off, regular transactions work on web and app',
    setting: 'Progressivelockout = 0',
    blocker: 'Steps unclear: which "regular transactions and activities". Ask QA. App part is out of scope.',
  },
  {
    tc: 'TC10610',
    area: 'User block',
    about: 'A blocked user cannot log in',
    coveredBy: ['UBLK-03'],
    setting: 'Progressivelockout = 1',
    mismatch: 'Sheet precondition says Progressivelockout=0 but expects a block; read as =1.',
    gap: { remaining: 'Out of scope', note: 'Web only; the mobile app part is not covered.' },
  },

  // ───────────────────────── User form settings (Settings → Form Settings → User Form) ─────────────────────────
  {
    tc: 'TC9563',
    area: 'User form settings',
    about: 'Success message after updating the User Form',
    client: 'RB',
    setting: 'isusercustomized = 1',
    blocker: 'Needs isusercustomized = 1, which is company-wide and off on devarun; switching it on changes the form for every user.',
  },
  {
    tc: 'TC9567',
    area: 'User form settings',
    about: 'Success message shows every time the User Form is updated',
    client: 'RB',
    setting: 'isusercustomized = 1',
    blocker: 'Same as TC9563.',
  },

  // ───────────────────────── Not covered: API ─────────────────────────
  { tc: 'TC9432', area: 'API', about: 'User creation API: invalid email gives a clear error', client: 'RB', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9440', area: 'API', about: 'User creation API: missing username gives "Please provide username"', client: 'RB', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9441', area: 'API', about: 'User creation API: success with username and mandatory fields', client: 'RB', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9488', area: 'API', about: '/users/editapi returns the updated user', client: 'RB', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9494', area: 'API', about: '/users/editapi does not return null for correct data', client: 'RB', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9509', area: 'API', about: 'users/getaccesstoken loads without "Invalid request url"', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9510', area: 'API', about: 'An unknown route gives a proper error', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9513', area: 'API', about: 'User info API: same structure on Laravel and CakePHP', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9515', area: 'API', about: 'User info API: same keys and data types on Laravel and CakePHP', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9522', area: 'API', about: 'Add user by curl request', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9523', area: 'API', about: 'Add user via the Integration API gives no errors', client: 'Laravel dev', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9538', area: 'API', about: 'Users API returns active and inactive users', client: 'Happilo', notCovered: 'API case; the suite tests the web UI' },
  { tc: 'TC9560', area: 'API', about: 'Users API with a wrong call / company id does not crash', client: 'Happilo', notCovered: 'API case; the suite tests the web UI' },

  // ───────────────────────── Not covered: mobile app ─────────────────────────
  { tc: 'TC8996', area: 'Mobile app', about: 'A newly created user can log in on the mobile app', notCovered: 'Mobile app case; the suite tests the web' },
  { tc: 'TC10594', area: 'Mobile app', about: 'Last app logout time is updated in Login Details', client: 'Custom branch', notCovered: 'Mobile app case; the suite tests the web' },
  { tc: 'TC10596', area: 'Mobile app', about: 'Last app login details are updated in Login Details', client: 'Custom branch', notCovered: 'Mobile app case; the suite tests the web' },

  // ───────────────────────── Not covered: other modules (TODO-later-user-module.md) ─────────────────────────
  { tc: 'TC9434', area: 'Other module', about: 'Sales Report refreshes after a sale (sales / reports)', client: 'RB', notCovered: parked },
  { tc: 'TC9435', area: 'Other module', about: 'Sales Report not refreshed after a sale (sales / reports)', client: 'RB', notCovered: parked },
  { tc: 'TC9438', area: 'Other module', about: 'Forgot Password with an unknown user gives "not found", not a 504 (login)', client: 'RB', notCovered: parked },
  { tc: 'TC9448', area: 'Other module', about: 'Invalid Microsoft email refused in SSO configuration (SSO)', client: 'BAT', notCovered: parked },
  { tc: 'TC9451', area: 'Other module', about: 'Outlet type change approved / rejected by the approver (outlets)', client: 'RB', notCovered: parked },
  { tc: 'TC9472', area: 'Other module', about: 'Outlet type change approval does not freeze (outlets)', client: 'RB', notCovered: parked },
  { tc: 'TC9568', area: 'Other module', about: 'Warehouse Edit page loads (warehouses)', client: 'BAT', notCovered: parked },
];

/** Sheet case codes per criterion ID, e.g. `UADD-03` → ['TC8985', 'TC9433', …]. */
export function sheetCasesFor(criterionId: string): string[] {
  return userModuleCases.filter((c) => 'coveredBy' in c && c.coveredBy.includes(criterionId)).map((c) => c.tc);
}
