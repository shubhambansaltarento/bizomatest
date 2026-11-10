# bizom-e2e: Framework Proposal

| Field   | Value                                                                   |
| ------- | ----------------------------------------------------------------------- |
| Status  | **Proposal**. Nothing in this document is implemented yet               |
| Owner   | Shubham Bansal                                                          |
| Created | 20 Oct 2026                                                             |
| Review  | Revisit as product knowledge grows; the structure will change after that |

This document records where the automation framework stands today, the structure we want to move to, and the changes that would get us there. Product knowledge of Bizom is still limited, so the architecture below is a direction, not a decision. Sections marked **Open question** need answers from the product or dev team before we commit.

---

## 1. Current state (20 Oct 2026)

**Stack:** Playwright 1.64 + TypeScript, Chromium only, run locally against `devarun.bizomdev.in`.

```
bizom-e2e/
├── config/env.ts            # reads .env (BASE_URL, credentials, DM_NEW_PASSWORD)
├── fixtures/
│   ├── auth.fixture.ts      # loginPage, appShell, authedPage (login before, logout after)
│   └── spec.ts              # spec() helper: tags tests with requirement IDs
├── pages/                   # AppShell, LoginPage, UsersListPage, UserEditPage, SalePage
├── specs/                   # spec-first Markdown specs (AUTH, USR, SALE) + template
├── tests/                   # auth/, users/, sales/
├── scripts/spec-check.mjs   # every spec criterion has a test, and vice versa
├── playwright.config.ts
└── CLAUDE.md                # working rules (spec before test, selectors in pages/, …)
```

**Coverage:** 3 specs, 19 acceptance criteria, 10 tests, all passing.

### What is already in line with common practice

- Playwright + TypeScript, the usual default for new web end-to-end suites.
- Page Object Model; selectors are kept out of test files.
- Login/logout shared through a fixture rather than repeated in each test.
- Config and secrets in a git-ignored `.env`.
- Screenshots, video and trace kept on failure; retries only in CI.
- **Spec-driven traceability.** Every test is tagged with the criterion it covers, and `npm run spec:check` fails if a criterion has no test or a test points to an ID that doesn't exist. Many teams get this only through a test-management tool (TestRail, Xray, Jira).

### Gaps and known issues

| # | Gap / issue | Impact |
| - | ----------- | ------ |
| G1 | Not a git repository | No history, review or CI trigger |
| G2 | No `tsconfig.json` / type check | Playwright strips types without checking them, so type errors appear only at runtime |
| G3 | No lint / format (ESLint, Prettier) | Missing `await`s and similar mistakes go unnoticed |
| G4 | Every test logs in through the login screen | Slow, and repeated runs trip the dev server's login throttling (about 30 logins in 30 seconds) |
| G5 | Tests change shared data: they reset real users' passwords, pick random real users and buyers, and use up stock | Runs affect other people; Pricing Warehouse 2 stock runs out after about 14 more sales |
| G6 | Widget logic (Select2, DataTables, jQuery UI dialogs, wizard) is copied into each page object | The same fix has to be made in several places |
| G7 | 7 waits for "network idle" and 1 fixed `waitForTimeout` | Main source of the flakiness seen so far |
| G8 | No CI pipeline | Tests run only when someone runs them by hand |
| G9 | One hard-wired environment | Can't point at QA or staging without editing `.env` |
| G10 | No stable test selectors (`data-testid`) | The app reuses ids (`#changepwdlink` is on two buttons) and the tests depend on CSS classes |
| G11 | Intermittent logout race: an in-flight request can keep the session alive after logout | Fixed by waiting for the page to settle, but the root cause is in the app |

---

## 2. Proposed architecture

### 2.1 Layers

Each layer only uses the layers below it. Tests never touch selectors directly.

```
 tests/            what to check         one test per spec criterion, tagged with IDs
    │
 fixtures/         how a test starts     logged-in page per role, page objects, test data
    │
 pages/            what a screen offers  LoginPage, UsersListPage, SalePage …
    │
 components/       reusable widgets      Select2, DataTable, JqDialog, Wizard, Navbar
    │
 api/ + data/      setup and cleanup     create users / stock / outlets without the UI
    │
 config/           where and as whom     environment, base URL, credentials per role
```

### 2.2 Proposed folder structure

```
bizom-e2e/
├── .github/workflows/e2e.yml      # or the GitLab/Jenkins equivalent (Open question Q6)
├── config/
│   ├── env.ts                     # picks TEST_ENV, checks required values at startup
│   └── environments/
│       ├── dev.ts                 # non-secret settings per environment
│       └── qa.ts
├── docs/
│   └── framework-proposal.md      # this file
├── specs/                         # unchanged: spec-first Markdown, one folder per module
├── src/
│   ├── components/                # Select2, DataTable, JqDialog, Wizard, Navbar
│   ├── pages/                     # page objects built from components
│   ├── api/                       # API clients for setup/cleanup (if available, Q3)
│   ├── data/                      # test users per role, data builders, seeded random
│   ├── fixtures/
│   │   ├── auth.fixture.ts        # adminPage, dmPage …: start already logged in
│   │   ├── pages.fixture.ts       # page objects injected into tests
│   │   └── index.ts               # merges everything into one `test` export
│   └── utils/                     # spec() helper, logger, small helpers
├── tests/
│   ├── setup/auth.setup.ts        # logs in once per role → .auth/<role>.json
│   ├── auth/                      # the only tests that use the login screen
│   ├── users/
│   └── sales/
├── scripts/spec-check.mjs
├── playwright.config.ts           # projects: setup → chromium (depends on setup)
├── tsconfig.json                  # strict, path aliases (@pages/*, @components/*, @fixtures)
├── eslint.config.mjs              # + eslint-plugin-playwright
├── .prettierrc
├── .nvmrc                         # pinned Node version
└── README.md                      # how to run, conventions, how to add a module
```

### 2.3 Key design decisions

**Saved login per role.** A setup project logs in once per role (admin, distributor manager, …) and saves the browser session to `.auth/<role>.json`. Tests start already logged in through fixtures such as `adminPage` or `dmPage`. Only the AUTH tests use the login screen. This removes most logins from a run (fixes G4) and makes tests faster.

```ts
// Target shape of a module test
import { test, expect } from '@fixtures';

test('SALE-05 Step 2: every item is added with 1 case',
  { tag: ['@regression', '@destructive', '@SALE-05'] },
  async ({ dmPage, salePage }) => { … });
```

**Component objects for Bizom's widgets.** Bizom reuses the same jQuery-era widgets on many screens. Model each once:

| Component  | Seen on                                | Behaviour to put in one place                        |
| ---------- | -------------------------------------- | ---------------------------------------------------- |
| `Select2`  | Sale page (buyer)                      | Open, search, pick an option, wait for dependent data |
| `DataTable`| Users list, sale order table           | Page size, summary text, read rows, redraw-safe input |
| `JqDialog` | Password change, alerts, warehouse prompt | Find by title, buttons, close, "can't be closed" case |
| `Wizard`   | Sale page                              | Next / Previous / Finish, current step, disabled state |
| `Navbar`   | Every page                             | Welcome banner, role, user menu, logout               |

**Test tags drive which tests run where.**

| Tag            | Meaning                               | Runs                                    |
| -------------- | ------------------------------------- | --------------------------------------- |
| `@smoke`       | Critical path, fast                   | Every PR                                |
| `@regression`  | Full behaviour coverage               | Nightly                                 |
| `@destructive` | Changes shared data (passwords, sales, stock) | Only on environments where that's allowed; never on production |
| `@<ID>`        | Spec criterion (already in place)     | `--grep @SALE-05` for one criterion     |

**Test data.** Move from "pick a random real user" to dedicated test accounts and data that tests create and clean up. Random choices stay, but with a logged seed so a failing run can be replayed exactly.

**Waiting.** Replace "network idle" and fixed sleeps with waits for something specific: a particular server response, an element appearing, or a value changing.

**Spec-first workflow stays.** `specs/`, requirement IDs and `spec:check` carry over unchanged. Later they can be linked to Jira or a test-management tool if the team uses one.

---

## 3. Proposed changes, by phase

Each phase can ship on its own. Tests should pass after every phase.

### Phase 1: Basics (≈ ½ day, no behaviour change)

- [ ] `git init`; commit the current state as the baseline
- [ ] `tsconfig.json` (strict) + `npm run typecheck` (`tsc --noEmit`)
- [ ] ESLint with `eslint-plugin-playwright`, Prettier, `npm run lint`
- [ ] Optional pre-commit hook (lint + typecheck + spec:check)
- [ ] `.nvmrc`; pin `@playwright/test` to an exact version
- [ ] `README.md`: setup, running, conventions, adding a module

### Phase 2: Structure (≈ 1–2 days, files move, behaviour stays the same)

- [ ] Move code into `src/` with path aliases
- [ ] Extract components: `Select2`, `DataTable`, `JqDialog`, `Wizard`, `Navbar`
- [ ] Page objects injected through fixtures; one merged `test` export
- [ ] Auth setup project + saved login per role (`adminPage`, `dmPage`)
- [ ] Add `@smoke` / `@regression` / `@destructive` tags; npm scripts per tag
- [ ] Replace "network idle" and `waitForTimeout` with specific waits (G7)
- [ ] Environment selection via `TEST_ENV` with startup validation (G9)

### Phase 3: CI (≈ ½ day once the CI tool is known)

- [ ] Pipeline: PR → `@smoke`; nightly → `@regression`
- [ ] Official Playwright Docker image, pinned version
- [ ] JUnit + HTML reports as build artifacts; traces on failure
- [ ] Credentials from CI secrets, not `.env`
- [ ] Split across machines (sharding) once the suite is large enough

### Phase 4: Test data and environment (needs the Bizom dev team)

- [ ] Dedicated e2e accounts per role (stop resetting real users' passwords)
- [ ] Data setup and cleanup through APIs, if Bizom has them (Q3)
- [ ] Stock top-up or reset for the sales flow (G5)
- [ ] A test environment without reCAPTCHA / login throttling, or an allow-list for the test runner
- [ ] `data-testid` attributes on key controls; configure `testIdAttribute` (G10)
- [ ] Report the logout session race (G11) and the duplicate `#changepwdlink` id to the dev team

### Later / nice to have

- Accessibility checks (axe) on key pages
- Visual comparison for stable screens
- Firefox / WebKit projects if customers use them
- Flaky-test tracking (quarantine tag, weekly review)

---

## 4. Open questions (product knowledge to gather)

These decide parts of the architecture. Answers will change this document.

| #  | Question | Affects |
| -- | -------- | ------- |
| Q1 | Which user roles matter for automation, and what can each do? (admin, zone / sales / warehouse / distributor manager, salesman …) | Saved logins per role, fixtures |
| Q2 | Which business flows are most critical (orders, sales, collections, inventory, reports)? | What becomes `@smoke`; which modules to automate next |
| Q3 | Does Bizom have APIs we can use for setup and cleanup (the mobile app's API, internal REST)? | Whether `src/api/` exists, and how test data is created |
| Q4 | Which environments exist (dev, QA, staging, UAT), and which allow destructive tests? | `config/environments/`, `@destructive` policy |
| Q5 | Can we get dedicated test accounts and resettable data (users, outlets, stock)? | Test data strategy (G5) |
| Q6 | Which CI tool does the team use (GitHub Actions, GitLab CI, Jenkins)? | Phase 3 |
| Q7 | Is there a test-management or ticket tool to link specs to (Jira, TestRail, Xray)? | Spec ID format, reporting |
| Q8 | Is the "new experience" UI (shown on the login page) replacing the current screens? | Whether to invest in selectors for current screens or wait |
| Q9 | Can the dev team add `data-testid` attributes? | Selector strategy |

---

## 5. Decision log

Record decisions here as they are made.

| Date        | Decision | Reason |
| ----------- | -------- | ------ |
| 19 Oct 2026 | Spec-first workflow: Markdown spec with criterion IDs before tests | Keeps tests traceable to agreed behaviour |
| 19 Oct 2026 | Login/logout shared through a fixture | Every module needs it; one place to fix |
| 20 Oct 2026 | Keep the current structure until product knowledge improves; this proposal guides the later restructure | Avoid locking in an architecture before the product is understood |
