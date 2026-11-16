/**
 * User creation module: every user-creation case of the QA sheet
 * `docs/TestCases_11-11-26-07_45_22.csv` (module AD_Users, 111 cases, exported 11 Nov 2026) that runs
 * in the web app, and the criterion that tests it. Full sheet coverage (all 111 cases):
 * docs/test-case-coverage.csv.
 *
 * Specs: specs/user-creation/ (UADD, UVAL, UFORM; config/UIMG). Tests: tests/user-creation/.
 * Run: `npm run test:user-creation`, and `npm run test:user-creation:config` for the UIMG cases.
 *
 * Left out on purpose: API cases (TC9432, TC9440, TC9441, TC9522, TC9523) and mobile app cases
 * (TC8996). The sheet's other AD_Users cases (users list, edit, user view, progressive lockout, login
 * details, attendance_audit) belong to other modules.
 *
 * `status`:
 * - 'covered': tested by `coveredBy`, and passing.
 * - 'knownBug': tested by `coveredBy`, which is marked `test.fail` because the app does not do what
 *   the sheet expects (`bug` says what happens instead).
 * - 'blocked': has a placeholder test (`test.fixme`) but cannot run on devarun yet (`note` says why).
 *
 * `client`: the sheet wrote the case for this client / environment; we run it on devarun (BASE_URL).
 */
export type CaseStatus = 'covered' | 'knownBug' | 'blocked';

export type CreationCase = {
  /** Case code in the sheet. */
  tc: string;
  title: string;
  status: CaseStatus;
  /** Criterion IDs that test it. */
  coveredBy: string[];
  /** Client / environment the sheet wrote it for; absent when generic. */
  client?: string;
  /** App setting the case depends on (see data/settings.ts). */
  setting?: { name: string; value: string };
  /** For 'knownBug': what the app does instead (checked 16 Nov 2026). */
  bug?: string;
  /** Where the sheet disagrees with the app or with itself. */
  mismatch?: string;
  note?: string;
};

export const userCreationCases: CreationCase[] = [
  // Opening the form
  { tc: 'TC8980', title: 'New User opens the Add User page', status: 'covered', coveredBy: ['UFORM-01', 'ULIST-08'] },
  { tc: 'TC8998', title: 'Add User form opens blank, also right after saving a user (bug 130313)', status: 'covered', coveredBy: ['UFORM-01'] },

  // Username
  {
    tc: 'TC8981',
    title: 'A blank username is refused',
    status: 'knownBug',
    coveredBy: ['UFORM-03'],
    bug: 'The form is sent; the server answers "Username already taken, please try with other name" on an emptied form. The sheet\'s "User Name cannot be left blank." only shows when another check fails too.',
  },
  { tc: 'TC9003', title: 'Taken username is refused', status: 'covered', coveredBy: ['UADD-01'] },
  { tc: 'TC9004', title: 'Username with letters, digits and @ . _ is available', status: 'covered', coveredBy: ['UFORM-02'] },

  // Name
  {
    tc: 'TC9005',
    title: 'A name another user already has is accepted',
    status: 'covered',
    coveredBy: ['UFORM-04'],
    mismatch: 'Sheet title says "existing password", but its steps and expected result are about the Name field.',
  },

  // Password
  { tc: 'TC8983', title: 'Password is mandatory', status: 'covered', coveredBy: ['UVAL-03'] },
  { tc: 'TC8984', title: 'The password rule list shows what is missing', status: 'covered', coveredBy: ['UFORM-05', 'UVAL-04'] },

  // Role and mapping
  {
    tc: 'TC8982',
    title: 'Role is mandatory',
    status: 'covered',
    coveredBy: ['UVAL-05'],
    mismatch: 'Sheet says "Please select role details."; the app says "Please select a Role details."',
  },
  {
    tc: 'TC9437',
    title: 'Add is refused when the role mapping cannot load',
    status: 'covered',
    coveredBy: ['UFORM-12'],
    client: 'RB',
    mismatch: 'Sheet title is "NA"; the title here comes from its steps.',
  },
  { tc: 'TC9011', title: 'Zone appears after the role, Subzone after the zone', status: 'covered', coveredBy: ['UFORM-11'] },
  {
    tc: 'TC9012',
    title: 'Distributor appears after Subzone, Area after Distributor',
    status: 'covered',
    coveredBy: ['UFORM-11'],
    mismatch: 'Sheet title mentions Reporting To, but its steps do not.',
  },

  // Optional fields
  { tc: 'TC9006', title: 'An 8-digit phone number is invalid', status: 'covered', coveredBy: ['UFORM-06'] },
  { tc: 'TC9007', title: 'A 10-digit phone number is valid', status: 'covered', coveredBy: ['UFORM-07'] },
  { tc: 'TC9008', title: 'Designation can be picked, before and after picking a role', status: 'covered', coveredBy: ['UFORM-08'] },
  {
    tc: 'TC9009',
    title: 'Date of birth is picked from a calendar',
    status: 'covered',
    coveredBy: ['UFORM-09'],
    mismatch: 'Sheet says dd-mm-yyyy; the app shows and saves YYYY-MM-DD.',
  },
  { tc: 'TC9010', title: 'Date of birth cannot be in the future', status: 'covered', coveredBy: ['UFORM-10'] },

  // Custom fields
  {
    tc: 'TC9442',
    title: 'User custom fields keep their configured order on Add, View and Edit',
    status: 'blocked',
    coveredBy: ['UFORM-13'],
    client: 'Swastiks',
    note: 'devarun has no user custom fields (16 Nov 2026); creating them changes the form for every user.',
  },
  {
    tc: 'TC9443',
    title: 'After re-ordering the custom fields, Add, View and Edit show the new order',
    status: 'blocked',
    coveredBy: ['UFORM-13'],
    client: 'Swastiks',
    mismatch: 'Sheet gives it the same title as TC9442.',
    note: 'Same as TC9442.',
  },

  // Saving
  { tc: 'TC8985', title: 'Admin creates a user; "User added successfully" shows', status: 'covered', coveredBy: ['UADD-03'] },
  { tc: 'TC9433', title: 'User can be created', status: 'covered', coveredBy: ['UADD-03'], client: 'BAT' },
  { tc: 'TC9436', title: 'Creating a user with all mandatory fields gives no 500', status: 'covered', coveredBy: ['UADD-03'], client: 'RB' },
  { tc: 'TC9495', title: 'New user is added without errors and is in the list', status: 'covered', coveredBy: ['UADD-03'], client: 'Laravel dev' },
  { tc: 'TC9504', title: 'No 5xx when adding a user', status: 'covered', coveredBy: ['UADD-03'], client: 'Laravel dev' },

  // After creation
  { tc: 'TC8995', title: 'A newly created user can log in on the web', status: 'covered', coveredBy: ['UFORM-14'] },

  // Attendance verification images (on the Edit page, set up right after creating the user)
  {
    tc: 'TC9524',
    title: '3 attendance verification images save without 5xx',
    status: 'covered',
    coveredBy: ['UIMG-01', 'UIMG-02', 'UIMG-03'],
    client: 'Laravel dev',
    setting: { name: 'attendanceFaceVerification', value: '1' },
  },
  {
    tc: 'TC9531',
    title: 'Uploading attendance verification images gives no 5xx',
    status: 'covered',
    coveredBy: ['UIMG-03'],
    client: 'Laravel dev',
    setting: { name: 'attendanceFaceVerification', value: '1' },
  },
  {
    tc: 'TC9537',
    title: '3 images are saved and still shown after reload',
    status: 'covered',
    coveredBy: ['UIMG-03'],
    client: 'Laravel dev',
    setting: { name: 'attendanceFaceVerification', value: '1' },
  },
  {
    tc: 'TC9532',
    title: 'After 5 images a 6th cannot be added',
    status: 'knownBug',
    coveredBy: ['UIMG-04', 'UIMG-05'],
    client: 'Laravel dev',
    setting: { name: 'attendanceFaceVerification', value: '1' },
    bug: 'Right after the 5th upload the file input is still offered and no message shows (UIMG-05); a 6th is refused and the message shows when one is tried, or after reopening (UIMG-04 passes).',
  },
];

/** Cases not fully passing yet: app bugs and blocked cases. */
export const openCases = userCreationCases.filter((c) => c.status !== 'covered');
