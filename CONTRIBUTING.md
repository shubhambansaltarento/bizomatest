# Adding test cases to bizom-e2e

This guide is for anyone adding automated tests to this suite: a new module (Outlets, Orders, Schemes, …) or more cases for a module that already exists. Follow the steps in order. The guide is long, but most steps take only a few minutes once you have done them once.

**Stack:** Playwright + TypeScript, Chromium, run against the Bizom dev server (`BASE_URL` in `.env`).

---

## 1. One-time setup

1. **Install Node.js 22 or newer** (`node -v`). The suite uses `process.loadEnvFile`, which older versions don't have.
2. **Clone and install:**
   ```bash
   git clone https://github.com/shubhambansaltarento/bizomatest.git bizom-e2e
   cd bizom-e2e
   npm install
   npx playwright install chromium
   ```
3. **Create your `.env`:** copy `.env.example` to `.env` and fill in the values. Ask the suite owner for the credentials. `.env` is git-ignored: **never commit it and never put a password in code.**
4. **Check that everything works:**
   ```bash
   npx playwright test tests/auth --headed   # the login tests should pass
   npm run spec:check                        # should print "N/N criteria have tests"
   ```

Recommended: install the VS Code extension **Playwright Test for VSCode** to run and debug single tests from the editor.

---

## 2. How the framework is organised

```
bizom-e2e/
├── specs/                 # 1. WHAT we test: one Markdown spec per flow (start here)
│   ├── _template.md       #    copy this for a new flow
│   ├── README.md          #    workflow + index of every spec
│   └── <module>/<flow>.md
├── tests/                 # 2. The Playwright tests, one file per spec
│   └── <module>/<flow>.spec.ts
├── pages/                 # 3. Page objects: ALL selectors and page actions live here
├── data/                  # 4. Test data and expected values (roles, settings, users, QA sheet mapping)
├── fixtures/              # 5. Shared setup: login, settings changes, test users, spec() helper
├── config/env.ts          #    reads .env
├── scripts/               #    spec-check (coverage) and the users QA-sheet report
└── playwright.config.ts
```

How one test case flows through the folders:

```
specs/outlets/outlets-list.md       ### OUT-01 Admin can open the outlets list   (Given / When / Then)
        │
        ▼
tests/outlets/outlets-list.spec.ts  test('OUT-01 …', spec('outlets/outlets-list', 'OUT-01'), …)
        │  uses
        ├── fixtures/auth.fixture.ts    authedPage (already logged in, logs out afterwards)
        ├── pages/OutletsListPage.ts    selectors + actions
        └── data/…                      expected values
```

### The rules (read these once)

| # | Rule | Why |
| - | ---- | --- |
| 1 | **Spec before test.** Every test case starts as an acceptance criterion in `specs/`. | The spec is what the team reviews; the test proves it. |
| 2 | **Check the real app first.** Try the flow by hand on `BASE_URL` before writing a criterion. If the app and the QA sheet disagree, raise it; don't quietly change either one. | Tests should describe how the app really behaves. |
| 3 | **One test per criterion**, titled `<ID> <title>`, linked with `spec(...)`. | `npm run spec:check` and `--grep @ID` depend on it. |
| 4 | **Selectors only in `pages/`**, never in test files. | When the UI changes, we fix one file. |
| 5 | **Never write your own login.** Use the `authedPage` fixture. | Login is slow and fragile on dev; one shared, tested version. |
| 6 | **No CSS-framework selectors** (`data-toggle`, Bootstrap classes). Prefer visible text, roles, ids. | Bootstrap's upgrade in Oct 2026 broke every test that used `data-toggle`. |
| 7 | **Known app bug: keep the test, mark it `test.fail(true, '<reason>')`.** Never delete or weaken the assertion. | The suite stays green and tells us when the bug is fixed. |
| 8 | **Credentials only from `.env`.** | Security. |
| 9 | **Users you create start with `e2e.`** and are cleaned up by the test. | Never touch real people's accounts. |
| 10 | **Settings are changed only through the `appSettings` fixture.** | It always restores the original value, also when the test fails. |

---

## 3. Adding test cases, step by step

The example below adds a new **Outlets** module with the ID prefix `OUT`. The URLs and selectors in it are made up for illustration; take the real ones from the app.

> **Adding cases to a module that already exists?** Skip to step 3.3: add the new criteria (next free ID) to the existing spec, then add the tests to the existing test file. Reuse the existing page objects and add to them.

### 3.1 Pick a module folder and an ID prefix

- **Folder name:** short, lower case, hyphenated: `outlets`, `orders`, `user-creation`.
- **ID prefix:** upper-case letters only (`OUT`, `ORD`), **unique** across the suite. Check the index in [`specs/README.md`](specs/README.md) for prefixes already taken.
- IDs are numbered `OUT-01`, `OUT-02`, … and are **never reused or renumbered**, even when a criterion is removed.

### 3.2 Explore the flow by hand

Open `BASE_URL`, log in, and walk through the flow. Note:

- the URLs of each page,
- the visible text, headings, labels and buttons you will check,
- the data the flow needs (which user, which outlet …) and what it changes,
- anything that looks like a bug (write it down; see 3.9).

`npx playwright codegen <BASE_URL>` records your clicks and suggests selectors. Use it to find selectors, then move them into a page object (don't paste the recorded script as a test).

### 3.3 Write the spec

```bash
mkdir -p specs/outlets
cp specs/_template.md specs/outlets/outlets-list.md
```

Fill it in. Each acceptance criterion is a `###` heading **exactly** in the form `### <ID> <title>`, followed by Given / When / Then:

```markdown
### OUT-01 Admin can open the outlets list

- **Given** I am logged in as ADMIN
- **When** I open Sidebar → Outlets → Outlets
- **Then** the heading **Outlets** and the outlets table are shown
- **And** the table shows "Showing 1 to N of M entries", M ≥ 1

### OUT-02 Search finds an outlet by name

- **Given** I am on the outlets list
- **When** I search for an outlet's exact name
- **Then** only rows with that name are shown
```

Write criteria that a test can check: each **Then** is something visible on screen, a URL, or a value. Avoid "works correctly".

If the cases come from the QA sheet, add a `Sheet:` line under the criterion with the case codes (for example `Sheet: TC8981, TC8982`).

Set **Status** to `Draft` and add a row to the index table in [`specs/README.md`](specs/README.md).

**Get the spec reviewed** (a PR with only the spec is fine) before writing the tests.

### 3.4 Create or extend the page object

One class per page, in `pages/<Name>Page.ts`. Locators are `readonly` fields set in the constructor; actions and checks are `async` methods.

```ts
// pages/OutletsListPage.ts
import { expect, type Locator, type Page } from '@playwright/test';

export class OutletsListPage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly rows: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Outlets' });
    this.searchInput = page.getByRole('searchbox');
    this.rows = page.locator('#outlets-table tbody tr');
    this.summary = page.getByText(/Showing \d+ to \d+ of \d+ entries/);
  }

  async goto() {
    await this.page.goto('/outlets/index');
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.summary).toBeVisible();
  }

  async search(text: string) {
    await this.searchInput.fill(text);
  }
}
```

Before writing something new, look at what already exists:

| Need | Use |
| ---- | --- |
| Navbar, user menu, sidebar, "is logged in", logout | `pages/AppShell.ts` |
| A bootstrap-multiselect dropdown (most dropdowns in Bizom) | `pages/multiselect.ts` (`multiselectButton`, `pickInMultiselect`) |
| Users list / add / edit / details, settings, login | the matching file in `pages/` |

Selector preference, best first: `getByRole` / `getByLabel` / `getByText` → a stable `id` → a `name` attribute → a short CSS path. Avoid long CSS chains, `nth-child`, and Bootstrap attributes.

Explain anything surprising about the page in a short comment next to the locator or method (for example "the dropdown loads by Ajax, so reopen until the option is there").

### 3.5 Put test data in `data/`

Keep values the test compares against (expected menu items, messages, roles, settings) in `data/`, not in the test, so they are changed in one place:

- what a role should see → `data/roles.ts`
- app settings → `data/settings.ts`
- roles for Add User and new user data → `data/userRoles.ts`
- fixed automation accounts → `data/automationUsers.ts`

For a new module, create `data/<module>.ts` when you have more than a couple of values.

### 3.6 Write the tests

Create `tests/<module>/<flow>.spec.ts` with the same name as the spec.

```ts
// tests/outlets/outlets-list.spec.ts
import { test, expect } from '../../fixtures/auth.fixture';
import { spec as specFor } from '../../fixtures/spec';
import { OutletsListPage } from '../../pages/OutletsListPage';

// Spec: specs/outlets/outlets-list.md, one test per acceptance criterion.
const spec = (...ids: string[]) => specFor('outlets/outlets-list', ...ids);

test.describe('Outlets list', () => {
  test('OUT-01 Admin can open the outlets list', spec('OUT-01'), async ({ authedPage: page }) => {
    const outlets = new OutletsListPage(page);
    await outlets.goto();

    await expect(outlets.rows.first()).toBeVisible();
  });

  test('OUT-02 Search finds an outlet by name', spec('OUT-02'), async ({ authedPage: page }) => {
    const outlets = new OutletsListPage(page);
    await outlets.goto();
    const name = 'Some outlet'; // better: read a real name from the first row

    await outlets.search(name);

    await expect(outlets.rows).not.toHaveCount(0);
    for (const row of await outlets.rows.all()) {
      await expect(row).toContainText(name);
    }
  });
});
```

What matters here:

- **Import `test` and `expect` from the fixture file**, not from `@playwright/test`:
  - `fixtures/auth.fixture.ts` for normal tests (gives `authedPage`, `loginPage`, `appShell`, `loginAs`)
  - `fixtures/settings.fixture.ts` for config tests (adds `appSettings`, see 3.8)
- **The title starts with the ID**, and `spec('<module>/<flow>', '<ID>')` is the second argument. This tags the test `@OUT-01`.
- **Use `authedPage`** for anything behind login. It logs in as admin before the test and logs out afterwards. Tabs the test opened (pages that open in a new tab, such as Organisation → Add OUTLET) are closed before the logout.
- **Use web-first assertions** (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`). They wait and retry.
- **Never use `page.waitForTimeout(...)`** or wait for "network idle". Wait for the thing you need to see. If the app is slow to react, wrap the check in `await expect(async () => { … }).toPass({ timeout })`.
- **A long journey** whose criteria depend on each other (create → edit → delete) can be one test with one `test.step('OUT-05 …')` per criterion. Pass every ID to `spec()`: `spec('OUT-05', 'OUT-06', 'OUT-07')`.
- **Several checks on one page:** `expect.soft(...)` reports all failures instead of stopping at the first.
- **Tests run in parallel** (2 workers). A test must not depend on another test or on run order, and must clean up what it creates.

### 3.7 Run, check coverage, update the docs

```bash
npx playwright test tests/outlets --headed   # watch it run
npx playwright test --grep @OUT-02           # one criterion
npx playwright test tests/outlets --debug    # step through with the inspector
npm run spec:check                           # every criterion has a test, every tag has a criterion
npm run report                               # HTML report (screenshots, video, trace of failures)
```

Run the new tests **at least 3 times** before opening a PR; the dev server is slow and a flaky test costs everyone time.

Then:

1. Set the spec's **Status** to `Implemented` and update its row in [`specs/README.md`](specs/README.md).
2. For a new module, add a script to `package.json`, for example `"test:outlets": "playwright test tests/outlets --headed"`.
3. Add any app bugs or open questions to [`TODO.md`](TODO.md).

### 3.8 Special cases

#### Test as another role

```ts
test.describe('as distributor manager', () => {
  test.use({ role: 'distributorManager' }); // a key of `roles` in data/roles.ts
  test('OUT-10 …', spec('OUT-10'), async ({ authedPage: page }) => { … });
});
```

To add a role: add an entry to `data/roles.ts` and its account to `.env` / `.env.example` (and `config/env.ts`).

#### Log in as a second user in the same test

`loginAs(username, password)` opens a separate browser (its own cookies) while `authedPage` stays logged in as admin:

```ts
const { page: userPage, appShell } = await loginAs(user.username, user.password);
await appShell.expectLoggedIn();
```

#### The test needs its own user

```ts
import { createTestUser, deactivateTestUser } from '../../fixtures/testUsers';

test('OUT-11 …', spec('OUT-11'), async ({ authedPage }) => {
  const user = await createTestUser(authedPage, { role: 'REPORT ADMIN' });
  try {
    // … test with user.username / user.password …
  } finally {
    await deactivateTestUser(authedPage, user);
  }
});
```

Never use a real person's account, and never pick a random real user from a list to change.

#### The test needs an app setting changed (config tests)

Settings live on Settings → All Settings, which only an admin can open. Changing one can affect everyone on the server, so these tests are kept apart and run one at a time.

1. Add the setting to `data/settings.ts` with its `level`: `'user'` (can be set for one user, **preferred**) or `'company'` (whole company).
2. Put the spec in `specs/<module>/config/` (or `specs/config/`) and the test in `tests/<module>/config/` (or `tests/config/`). Anything under a `config/` folder is excluded from the normal run automatically.
3. Import from the settings fixture and use `appSettings`:
   ```ts
   import { test, expect } from '../../../fixtures/settings.fixture';
   import { createTestUser, deactivateTestUser } from '../../../fixtures/testUsers';

   test('OUTC-01 …', spec('OUTC-01'), async ({ authedPage, appSettings }) => {
     const user = await createTestUser(authedPage, { role: 'REPORT ADMIN' });
     try {
       await appSettings.setForUser('password_ageing_days', { role: user.role, username: user.username }, '30');
       // or, whole company: await appSettings.setForCompany('passwordresetlock', '1');
       // … the test …
     } finally {
       await appSettings.restoreNow(); // put settings back before the user is deactivated
       await deactivateTestUser(authedPage, user);
     }
   });
   ```
   Changed settings are put back after the test, pass or fail. Call `restoreNow()` yourself only before deactivating a user whose settings you changed (inactive users aren't listed on the settings page).
4. Add a script: `"test:outlets:config": "E2E_CONFIG=1 playwright test --project=config tests/outlets/config"`.
5. Run it with `npm run test:config` or your new script, never alongside the normal suite.

#### A test that must run completely on its own

If a test changes something that would break other tests running at the same time (like the progressive lockout tests), it needs its own Playwright project in `playwright.config.ts`, the same way `user-block` is set up. Talk to the suite owner before adding one.

### 3.9 When the app has a bug

Keep the test and the correct assertion, and mark it as an expected failure:

```ts
test('OUT-04 Saving with an empty name is refused', spec('OUT-04'), async ({ authedPage: page }) => {
  test.fail(true, 'App bug (17 Nov 2026): the outlet is saved with no name. See TODO.md');
  // … the real assertion …
});
```

- The run stays green while the bug exists, and reports **"unexpectedly passed"** once it's fixed. Then remove the `test.fail` line.
- Add the bug to the "App issues found" list in [`TODO.md`](TODO.md), with the date and the criterion ID, and note it under the criterion in the spec.
- If the test **can't run at all** (missing data, feature not on dev), use `test.fixme(true, '<reason>')` instead.
- If you're not sure whether it's a bug or the expected behaviour, ask the product / QA team before writing the criterion.

### 3.10 Linking to the QA sheet (users module)

The users module is mapped case by case to the QA sheet in `data/userModuleCases.ts`. If your tests cover user-module sheet cases:

1. Add the criterion ID to the case's `coveredBy` in `data/userModuleCases.ts` (never write `@TC…` tags by hand; `spec()` adds them).
2. Run `npm run coverage:users`. It checks the links and regenerates `docs/user-module/user-module-test-coverage.xlsx`.

Other modules don't have a sheet mapping yet. Until they do, put the case codes in a `Sheet:` line under each criterion.

---

## 4. Before you open a pull request

- [ ] Spec in `specs/<module>/<flow>.md`, reviewed, Status `Implemented`, row in `specs/README.md`
- [ ] One test per criterion, title `<ID> <title>`, linked with `spec(...)`
- [ ] No selectors in test files; new selectors are in `pages/`
- [ ] No login code in tests (`authedPage` / `loginAs` only)
- [ ] No `waitForTimeout`, no hard-coded credentials, no `test.only`
- [ ] Everything the test creates is cleaned up (`try` / `finally`)
- [ ] Known bugs are `test.fail` with a reason, and listed in `TODO.md`
- [ ] `npm run spec:check` passes
- [ ] New tests pass 3 runs in a row (`npx playwright test tests/<module> --repeat-each=3`)
- [ ] New `npm run` script added for a new module

Work on a branch (`git checkout -b tests/outlets-list`) and open a PR against `main`. Keep one module or flow per PR so it can be reviewed in one sitting.

---

## 5. Troubleshooting

| Problem | What to do |
| ------- | ---------- |
| `Missing env var X` | Add it to `.env` (see `.env.example`). |
| Login times out or lands on a blank page | The dev server is slow or throttling logins (about 30 logins in 30 s). Run fewer tests at once (`--workers=1`) and try again. |
| `spec:check` says `UNKNOWN ID FOO-12` | A quoted string in a test file looks like an ID (`'FOO-12'`, even `'UTF-8'`), but no spec has `### FOO-12`. Fix the ID or the string. |
| `spec:check` says `MISSING TEST` | A criterion has no test with its ID, or the spec heading isn't exactly `### <ID> <title>`. |
| Passes alone, fails in the full run | Two tests share data. Give each test its own data, or create it in the test. |
| A click does nothing right after the page opens | The page's scripts aren't ready yet. Retry the click inside `expect(async () => …).toPass()`, as in `AppShell.mainMenuSections`. |
| Need to see what happened | `npm run report`, open the failed test: screenshot, video, and (on retry) a trace. |
| Leftover `e2e.` users after an interrupted run | `npm run cleanup:e2e-users` |

## 6. Command reference

| Command | What it does |
| ------- | ------------ |
| `npm test` | Normal suite (not config / user-block) |
| `npx playwright test tests/<module> --headed` | One module, visible browser |
| `npx playwright test --grep @<ID>` | One criterion |
| `npx playwright test --ui` | Playwright UI mode |
| `npm run spec:check` | Criterion ↔ test coverage check |
| `npm run test:config` | All config tests, one at a time |
| `npm run test:user-block` | Progressive lockout tests, on their own |
| `npm run coverage:users` | Users QA sheet coverage Excel |
| `npm run cleanup:e2e-users` | Deactivate leftover automation users |
| `npm run report` | Open the last HTML report |

More detail: [`specs/README.md`](specs/README.md) (spec workflow and index), [`CLAUDE.md`](CLAUDE.md) (the full rule list), [`docs/framework-proposal.md`](docs/framework-proposal.md) (planned changes, not implemented yet).
