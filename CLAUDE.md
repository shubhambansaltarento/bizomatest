# bizom-e2e

Playwright end-to-end tests for Bizom, built spec-first. See `specs/README.md` for the full workflow.

## Rules

- **Spec before test.** A new flow starts as `specs/<module>/<flow>.md` (copy `specs/_template.md`). Write no test until the spec's acceptance criteria exist and the user has reviewed them.
- **Verify behaviour against the app** (`BASE_URL` in `.env`) before writing a criterion. If the app disagrees with the spec, tell the user; don't silently change either one.
- **One test per criterion**, titled `<ID> <title>` and linked with `spec('<module>/<flow>', '<ID>')` from `fixtures/spec.ts`. Sequential criteria of one journey may share a test, with one `test.step('<ID> …')` each.
- **Login/logout are shared.** Tests behind login use the `authedPage` fixture from `fixtures/auth.fixture.ts`; never re-implement login in a module spec.
- **Selectors live in `pages/`** (page objects), never in spec files.
- Credentials come from `.env` only; never hard-code them.

## Commands

- `npm run spec:check`: every criterion has a test, and every test ID exists in a spec
- `npx playwright test tests/<module> --headed`: run one module in a visible browser
- `npx playwright test --grep @AUTH-03`: run one criterion
- `npm run report`: open the last HTML report
