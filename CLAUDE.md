# bizom-e2e

Playwright end-to-end tests for Bizom, built spec-first. See `specs/README.md` for the full workflow, and `CONTRIBUTING.md` for the step-by-step guide for new contributors (keep it in step when the rules or fixtures below change).

Planned framework changes live in `docs/framework-proposal.md`. They are **not implemented**: keep the current structure until the user decides to move, and record decisions in that file's decision log.

## Rules

- **Spec before test.** A new flow starts as `specs/<module>/<flow>.md` (copy `specs/_template.md`). Write no test until the spec's acceptance criteria exist and the user has reviewed them.
- **Verify behaviour against the app** (`BASE_URL` in `.env`) before writing a criterion. If the app disagrees with the spec, tell the user; don't silently change either one.
- **One test per criterion**, titled `<ID> <title>` and linked with `spec('<module>/<flow>', '<ID>')` from `fixtures/spec.ts`. Sequential criteria of one journey may share a test, with one `test.step('<ID> …')` each.
- **Login/logout are shared.** Tests behind login use the `authedPage` fixture from `fixtures/auth.fixture.ts`; never re-implement login in a module spec. It logs in as admin; use `test.use({ role: '<role>' })` for another role from `data/roles.ts`.
- **Expected UI per role lives in `data/roles.ts`.** Change what a role should see there, not in tests.
- **Known app bugs:** keep the test and mark it `test.fail(true, '<reason>')` so the suite stays green and flags the fix; never delete or weaken the assertion.
- **Selectors must not depend on CSS-framework attributes** (e.g. Bootstrap's `data-toggle`, which became `data-bs-toggle` in Oct 2026). Prefer visible text, roles, ids.
- **Selectors live in `pages/`** (page objects), never in spec files.
- Credentials come from `.env` only; never hard-code them.
- **Config (settings) test cases:** app settings live on Settings → All Settings (`/settings/allsettings`), which **only an ADMIN can open**. A test that needs a setting changed uses the `appSettings` fixture (`fixtures/settings.fixture.ts`): it opens that page as admin in its own browser, edits the value, clicks **Review** then **Save**, and restores the original value after the test, pass or fail. Never change settings any other way. Known settings and whether they can be set for one user or only for the whole company are in `data/settings.ts`; prefer setting it for one automation user. Config tests live in a `config/` folder: `tests/config/` (specs in `specs/config/`), or a module's own `tests/<module>/config/` (e.g. `tests/user-creation/config/`). Any `config/` folder runs only in the config project (`npm run test:config`), one at a time, never alongside the normal suite.
- **User creation module** (`specs/user-creation/`, `tests/user-creation/`): everything about an admin adding a user, runnable on its own. Its QA sheet cases are in `data/userModuleCases.ts` with the rest of the user module.
- **User block module** (`specs/user-block/`, `tests/user-block/`): progressive lockout. It switches the company-wide `Progressivelockout` on and waits for blocks to run out, so it has its own Playwright project and runs **only on its own** (`npm run test:user-block`), never with the normal suite or the config tests. Number of wrong passwords: `USER_BLOCK_ATTEMPTS` in `.env` (2 to 9); expected messages in `data/userBlock.ts`.
- **User module ↔ QA sheet mapping:** `data/userModuleCases.ts` is the only place that links the users QA sheet (`docs/TestCases_11-11-26-07_45_22.csv`, 111 cases) to the code: each case lists the criterion IDs that cover it, or a `todo` / `blocker` / `notCovered` reason. `spec()` tags every test with its sheet cases (`@TC8981`) from that file; never write TC tags or statuses by hand. When a test is added, changed, marked `test.fail` / `test.fixme`, or a criterion's `Sheet:` line changes, update the mapping and run `npm run coverage:users`, which checks the links and regenerates `docs/user-module/user-module-test-coverage.xlsx`.
- **Automation users:** every user the tests create has a username starting with `e2e.` and is an automation user, not a real person. They are listed in `data/automationUsers.ts` (one fixed account per role for the lifecycle tests); tests change their passwords and status. Create new test users with that prefix (`newUserData` in `data/userRoles.ts`); a test that needs a user of its own uses the `newTestUser` fixture (`fixtures/auth.fixture.ts`), which deactivates it after the test, after `appSettings` has put settings back. Don't write create / `try` / `finally` / deactivate by hand.
- **Reuse actions and checks; don't copy them.** An action or assertion used by a second test belongs in a page-object method (`expect…` for checks) or a fixture, with its expected text in `data/`. Existing shared checks: `serverErrors.expectNone()` (fixture), `appShell.expectNoErrorPage()`, `usersList.expectUserAdded()` / `expectUserSaved()`.

## Commands

- `npm run spec:check`: every criterion has a test, and every test ID exists in a spec
- `npx playwright test tests/<module> --headed`: run one module in a visible browser
- `npx playwright test --grep @AUTH-03`: run one criterion
- `npx playwright test --grep @TC8981`: run the tests of one QA sheet case (config / user-block cases: see "Run it" in the coverage Excel)
- `npm run coverage:users`: check the user module's QA sheet mapping and write `docs/user-module/user-module-test-coverage.xlsx` (fails if a link is broken)
- `npm run test:config`: all config tests (every `config/` folder), one at a time; they change app settings and put them back
- `npm run test:user-creation`: the user creation module (normal tests)
- `npm run test:user-creation:config`: the user creation module's config tests (attendance images)
- `npm run test:users:config`: the users module's config tests (designation column)
- `npm run test:user-block`: the user block (progressive lockout) test, on its own; takes about USER_BLOCK_ATTEMPTS + 3 minutes
- `npm run cleanup:e2e-users`: deactivate leftover automation users (`e2e.*`), keeping the fixed accounts in `data/automationUsers.ts`
- `npm run report`: open the last HTML report
