# Merging playwright-automation into bizom-e2e

| Field   | Value                                                                                   |
| ------- | --------------------------------------------------------------------------------------- |
| Status  | **Proposal**. Nothing moved yet                                                         |
| Owner   | Shubham Bansal                                                                          |
| Created | 17 Nov 2026                                                                             |
| Source  | `../playwright-automation-main` (copy without `.git`; origin is GitLab `mobisy/playwright-automation`) |
| Inventory | [`pw-test-inventory.csv`](pw-test-inventory.csv): every pw test → target spec, criterion and action |

This compares the two suites, lists every module and test, and proposes how to bring the playwright-automation ("pw") modules into bizom-e2e the bizom way: **spec first, reviewed, then tests**. Decisions go into the decision log of [`framework-proposal.md`](framework-proposal.md).

---

## 1. The two suites at a glance

|                         | bizom-e2e                                         | playwright-automation (pw)                                   |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Environment             | `devarun.bizomdev.in`                             | `devauto.bizomdev.in` (+ Hersheys staging for schemes)       |
| Modules                 | auth, admin, roles, users, user-creation, user-block, sales, config | 17 spec files: masters, products, content, disclaimers, reasons, schemes |
| Specs / criteria        | 17 specs, 102 criteria, `spec:check` 102/102      | none: tests only, titled `TC<n>` or a QA id                  |
| Tests                   | one per criterion (some journeys share a test)    | 245 (incl. 50 + 13 data-driven cases, 3 scaffold/debug)      |
| Lines of test + page code | ~5,500                                          | ~14,000 (staggeredQps.spec alone 3,773)                      |

**No module is in both.** The suites touch the same app from different ends: bizom covers login, roles, users and one direct sale; pw covers masters, products, content and schemes. They meet on five shared screens and helpers (section 3).

---

## 2. Framework differences

| Aspect | bizom-e2e | pw | Take for the merged suite |
| --- | --- | --- | --- |
| Workflow | Spec (`specs/<module>/<flow>.md`, Given/When/Then, IDs) → review → test | Code first; README table lists modules | **bizom** |
| Traceability | `spec()` tags `@ID`; `spec:check` fails on gaps; QA sheet → criterion map (`test-case-coverage.csv`, `userCreationCases.ts`) | Masters: local `TC1..n` (gaps: state TC10, district TC2/9/12). Schemes: QA ids `st_AD_SCH_*`, `coversTestCases` | **bizom**, keeping pw's QA ids as a second tag |
| Login | `authedPage` fixture (role option), `loginAs` for a 2nd browser, logout checked | Every test logs in inline; user switch = `clearCookies()` + re-login; `loginAndWait` swallows failures | **bizom** |
| Isolation | `fullyParallel`, 2 workers; settings-changing tests in own projects | `workers: 1`, `fullyParallel: false`; tests depend on earlier TCs but not `serial`, so a failure cascades | **bizom**; schemes get their own serial project |
| Test data | Typed TS (`data/*.ts`); `e2e.` prefix; create + clean up (`createTestUser`) | JSON; fixed names (`TestingState`, `SchemeTesting1`, codes 1234/5678/6696); almost no cleanup | **bizom**, with pw's data-driven case shape for schemes |
| Known app bugs | `test.fail(true, reason)` + TODO.md issue list | none; `pending` flag in scheme data only | **bizom** |
| Settings | `appSettings` fixture, restored after test | none | **bizom** |
| Selectors | `pages/` only; no CSS-framework attributes | Masters/content: inline in specs; schemes: page + duplicated unused config | **bizom** |
| Waits | specific waits, `expect.toPass` | ~230 `waitForTimeout`, ~350 `networkidle`, ~160 `.catch(() => {})` | **bizom** |
| Timeouts | 60 s test, 10 s expect | 10 min test, 15 s expect, no action timeout: a missing element hangs 10 min | **bizom**; schemes project may raise the test timeout |
| Page objects | Plain classes, locators in constructor, `multiselect.ts` helper | `BasePage` inheritance (unused helpers); 4 pages are Java conversions full of `TODO_LOCATOR` | bizom, plus components (section 7) |
| Multi-env | one `.env` | portal registry (`SCHEMES_DATA` switches URL + accounts) | **pw idea**, done as `TEST_ENV` (framework-proposal G9) |
| TypeScript | no `tsconfig` (G2) | strict `tsconfig` | **pw** |
| Reporting | HTML | HTML + JSON + JUnit + Allure (+ merged history, PDF) | **pw** (JUnit for CI; Allure optional) |
| CI | none (G8) | GitHub Actions file, but repo is on GitLab and no secrets are passed, so every login fails | neither works; do Phase 3 of framework-proposal |
| Secrets | `.env` git-ignored | Plain passwords in `utils/environment.ts`, `config/portals.ts`, `config/portalData.ts`; README says some are committed | **bizom**. Never copy those files; ask for the exposed passwords to be changed |
| Docs | CLAUDE.md rules, specs index, TODO.md app-issue log, framework proposal | Good README (setup, pitfalls); `docs/` written for v1, out of date | bizom; move pw's pitfalls into README / CLAUDE.md |

---

## 3. Where the suites meet (same screens, different test cases)

| Shared area | bizom has | pw has | Merge action |
| --- | --- | --- | --- |
| **Login** | AUTH-01..11: valid/invalid, spaces, logout, Google button | `login.spec` (1 valid login), `sanity.spec` (expects `/users/dashboard`, which is wrong today) | pw adds nothing. Drop both; tag AUTH-01 `@smoke` |
| **Sale wizard** `/payments/sale` | `SalePage` (complete: warehouse prompt, select2 buyer, order table, payment mode, Finish result) for SALE-04..07 | Sale steps re-written inside `AdminSchemesPage` and `StaggeredQpsPage` (depo-zone modal, brand, units/cases, Step-3 total); pw `SalePage` is a TODO stub | One `SalePage` (bizom's), extended with zone modal, brand, cases/units and Step-3 total/scheme lines |
| **Add user** | user-creation module (UADD/UVAL/UFORM, `createTestUser`) | headquarters TC3 creates a WAREHOUSE MANAGER and assigns an HQ | HQ-03 uses `createTestUser`; HQ field goes into `UserAddPage` |
| **Admin sidebar** | ADM-02 opens every item, incl. Add Product, List Collaterals, List Pop, Schemes, New Scheme, Assign Schemes | Tests the inside of those pages | Complementary: ADM-02 stays the smoke check, new modules test the pages; sku TC9 folds into ADM-02 |
| **Settings** | `SettingsPage` = `/settings/allsettings` (admin-only values) | outletCategory: `/settings` → Outlet Categories tab (master data) | Separate page object; outlet categories are master data, not a `config/` test |
| **Role switch** | `loginAs` (own browser, own cookies) | `clearCookies` + `/users/logout` fallback (README notes it sometimes keeps the old session) | `loginAs` for disclaimer, reasons, schemes |
| **Widgets** | `multiselect.ts`; DataTables logic inside `UsersListPage` | Same widgets re-coded in each spec | Extract shared components (section 7) |
| **Accounts** | admin, `pricing.distributor` (DM) on devarun | `autoadmin`, `dist.manager` (banner says WAREHOUSE MANAGER), distributor (not set) on devauto | Per-environment accounts in `data/roles.ts` |

---

## 4. Modules only in pw

"Weak" = the check passes even when the action failed (e.g. `toHaveURL(/states/)` also matches `/states/add`, or only `body` is visible).

| pw spec | Tests | Covers | Assertion quality | Not covered | Target (specs/) | Proposed criteria |
| --- | --- | --- | --- | --- | --- | --- |
| state | 16 | list, headers, page size, search, download, links, create ×3, toggle active | mostly URL; create/edit weak; TC12 = TC9 | delete, validation, read-back | `states/states.md` (STATE) | 8 |
| cities | 10 | create, toggle ×2, change state, download, links, page size, state filter | weak; TC9 none | delete, validation | `cities/cities.md` (CITY) | 8 |
| districts | 14 | list, page size, search, download, links, create ×3 | weak | **edit**, delete, validation | `districts/districts.md` (DIST) | 7 |
| headquarters | 3 | add HQ, user with HQ | TC2/TC3 assert nothing real | HQ list, edit, delete | `headquarters/headquarters.md` (HQ) | 3 |
| warehouseType | 12 | list, page size, create, edit, delete | weak; TC10 = TC7; delete hits first match | download, validation | `warehouse-types/warehouse-types.md` (WHT) | 7 |
| outletType | 11 | list, create, search, page size, view/edit, download | 6 of 11 assert nothing; TC10 = TC1 | delete | `outlet-types/outlet-types.md` (OTYP) | 8 |
| outletCategory | 7 | settings tab, add, edit | **no real assertion in any test** | list features, delete | `outlet-categories/outlet-categories.md` (OCAT) | 4 |
| skuCreation | 9 | form, empty submit, create ×2, list values, edit price, filters, page size | **good**: values read back | delete/deactivate, messages | `products/sku.md` (SKU) | 8 |
| pops | 12 | create ×4 types, filters, search, rename, page size, active toggle | 11 of 12 assert only `body` | validation, delete | `pops/pops.md` (POP) | 8 |
| collaterals | 12 | create ×4 types, filters, search, rename, page size | 9 of 12 assert only `body`; rename may hit another row | deactivate, delete | `collaterals/collaterals.md` (COLL) | 8 |
| Disclaimer | 21 | form fields, submit, reset, list, edit, enable/disable, DM accepts at login and on place-order, approved list | several read back what they typed; save not proven; **TC18 disables every disclaimer on the page** | validation, content shown to DM | `disclaimers/disclaimer-form.md` (DISC), `disclaimers/disclaimer-acceptance.md` (DACC) | 6 + 4 |
| reasons | 20 | add, edit, activate/deactivate, pager, search, sort, categories nav, reject an order | TC3 good; **TC7 can deactivate real reasons**; **TC13 rejects the first order on /orders**; TC14 = TC4 | category CRUD, validation | `reasons/reasons.md` (RSN), `reasons/reason-categories.md` (RCAT) | 9 + 3 |
| adminSchemes | 50 (data) | create Qty/Value slab & prorated, free SKUs, apply-on, 11 holder types, 14 entity types + DM sale, end scheme | **no case checks a discount or free qty**; all use the name `SchemeTesting1` and rely on the previous case ending it | benefit on invoice | `admin-schemes/` (SCHC, SCHA, SCHS, SCHX) | 11 |
| staggeredQps | 30 | create → assign → DM sale → return → ledger | **best business checks in pw** (numeric totals and ledger); 90 % copy-paste; clawback (017) only logged | clawback, free qty | `staggered-qps/staggered-qps.md` (QPS) | 5 |
| foreveryStaggeredQps | 13 (data) | for-every QPS per unit type | **cannot run**: 58 `TODO_LOCATOR`s, distributor login not set | everything | `forevery-qps/forevery-qps.md` (FEQPS) | 3 (blocked) |

Inventory totals: **40 KEEP, 100 FIX, 80 MERGE, 12 DROP, 13 BLOCKED** → 110 criteria in 20 specs, 15 modules.

### Business rules worth keeping (from pw's data)

- **Staggered QPS:** only the matching slab applies. Apply type *Slab* = flat ₹ per invoice (QPS1: 3 × 30 − 4 = 86). *Prorated* = ₹ spread per unit (QPS16: 3 × 60 − 3 × 2 = 174). Returns are credited at net unit price (016: 1 of 3 → 58.00). If a return drops the kept quantity below a slab, the benefit is taken back as a separate credit-note row (017, "scheme note 2.00"); **nothing tests this with a number yet**.
- **Admin schemes:** creating a scheme with an existing name fails silently, so names must be unique per run.

---

## 5. Cross-cutting problems in pw (don't carry these over)

1. **Weak or missing assertions.** Most create/edit tests pass even if the save fails. Rule for the port: every criterion's **Then** must be something that is false when the feature is broken (row in list with the saved values, banner text, ledger amount).
2. **Fixed names and shared records.** Re-runs collide (`TestingState`, `QPS4` ×3, `SchemeTesting1` ×49); `.first()` + substring `hasText` picks old rows (`QPS1` matches `QPS10`). Use `e2e`-prefixed names with a run id, exact matching, and act only on records the test created.
3. **Destructive to shared data.** Disclaimer TC18, reasons TC7/TC13, warehouseType TC11. Rewrite them to act on own records only.
4. **Order dependence without `serial`.** TC5 needs TC3 and so on. Each test creates what it needs (fixture or helper); real multi-step journeys become one test with `test.step`s.
5. **Machine-specific files.** Uploads from `C:/Users/hanumesh/...` and `node_modules/.../appIcon.png`. Ship small fixture files in `data/files/`.
6. **Copy-paste.** staggeredQps: 3,773 lines with 128 distinct lines; config file imported by nothing. Data-drive it as adminSchemes already does.
7. **Secrets in files.** Do not copy `utils/environment.ts`, `config/portals.ts` or `config/portalData.ts`.

### What pw does better (bring it over)

- Strict `tsconfig` (closes framework-proposal G2).
- JUnit/JSON reporters for CI; Allure if the team wants run history.
- Data-driven case shape for schemes (`testId`, `coversTestCases`, `pending`), and its QA ids.
- `SkuCreationPage`: clean, ports almost unchanged.
- README "pitfalls" table (keep PC awake, log out properly, bound every wait).
- Knowledge of URLs, widgets and the scheme business rules above.

---

## 6. Target layout in bizom-e2e

Each pw spec file becomes its **own module** (own `specs/` and `tests/` folder, own npm script), as `user-creation` and `user-block` are today.

```
specs/                                   tests/  (same folders, *.spec.ts)
├── states/states.md            STATE    ├── states/
├── cities/cities.md            CITY     ├── cities/
├── districts/districts.md      DIST     ├── districts/
├── headquarters/headquarters.md HQ      ├── headquarters/
├── warehouse-types/…           WHT      ├── warehouse-types/
├── outlet-types/…              OTYP     ├── outlet-types/
├── outlet-categories/…         OCAT     ├── outlet-categories/
├── products/sku.md             SKU      ├── products/
├── pops/pops.md                POP      ├── pops/
├── collaterals/collaterals.md  COLL     ├── collaterals/
├── disclaimers/disclaimer-form.md DISC  ├── disclaimers/
│   └── disclaimer-acceptance.md DACC    │
├── reasons/reasons.md          RSN      ├── reasons/
│   └── reason-categories.md    RCAT     │
├── admin-schemes/scheme-create.md SCHC  ├── admin-schemes/    ← project "schemes" (serial)
│   ├── scheme-assign.md        SCHA     │
│   ├── scheme-sale.md          SCHS     │
│   └── scheme-end.md           SCHX     │
├── staggered-qps/staggered-qps.md QPS   ├── staggered-qps/    ← project "schemes"
└── forevery-qps/forevery-qps.md FEQPS   └── forevery-qps/     ← project "schemes"
```

Prefixes are letters only, because `spec-check.mjs` matches `[A-Z]+-\d+`.

Supporting files:

| File | Holds |
| --- | --- |
| `data/schemeCases.ts` | Admin scheme cases (typed version of `adminSchemesData.json`), each with QA id, `coversTestCases`, criterion |
| `data/staggeredQpsCases.ts` | The 30 QPS cases + expected totals/ledger amounts |
| `data/environments.ts` (or `config/environments/`) | Per-environment base URL, accounts and master data (zone, warehouse, outlets, SKUs) |
| `data/files/` | Small image / video / PDF for upload tests |
| `fixtures/masterData.ts` | `createTestRecord` / cleanup for masters (like `createTestUser`) |

**Projects:** `chromium` (normal, parallel) gets every master/content module. Add a `schemes` project like `user-block`: `workers: 1`, serial, opt-in (`npm run test:schemes`), tagged `@destructive` (creates schemes, invoices, returns, uses stock).

**Data-driven criteria:** one criterion per behaviour, one generated test per case (as UADD-03 does per role):

```ts
for (const c of schemeCases.filter((c) => c.criterion === 'SCHA-02')) {
  test(`SCHA-02 [${c.qaId}] Assign to ${c.holderType}`, { ...spec('admin-schemes/scheme-assign', 'SCHA-02'), tag: [`@${c.qaId}`] }, async ({ authedPage }) => { … });
}
```

---

## 7. The way: phases

### Phase 0: Decisions (before any file moves)

See section 8. The most important one is **which environment**: all pw data (zone South, Kholi/Bangalore warehouses, QpsProd*, outlets 117–135, `autoadmin`, `dist.manager`) exists only on **devauto**.

### Phase 1: Groundwork in bizom-e2e (no new tests; current 102 stay green)

1. `TEST_ENV` with `devarun` (default) and `devauto`: base URL, accounts and master data per environment (framework-proposal G9). Each spec states the environment it was verified on.
2. Roles for devauto in `data/roles.ts` (admin, distributor manager; distributor once its login exists).
3. Components extracted from existing page objects: `DataTable` (search, page length + row count, pager, download, row actions, redraw wait), `Select2`, `Datepicker`, `JqDialog`; reuse `multiselect.ts`.
4. `SalePage` extended for schemes (depo-zone modal, brand, cases/units/kg, Step-3 total and scheme lines).
5. Unique-name helper (`e2e` + run id that survives retries) and a cleanup registry; `npm run cleanup:e2e-masters`.
6. `data/files/` upload fixtures; `tsconfig.json` + `npm run typecheck`; JUnit reporter.
7. Add the 15 modules to CLAUDE.md rules and `specs/README.md` index (status Draft).

### Phase 2: Specs (Draft → reviewed), one module at a time

For each module:

1. Copy `specs/_template.md`. Use [`pw-test-inventory.csv`](pw-test-inventory.csv) for its criteria: **KEEP** and **FIX** rows become criteria, **MERGE** rows become steps or data rows of a criterion, **DROP** rows are listed under "Out of scope" with the reason.
2. **Verify each criterion on the app** (CLAUDE.md rule). Where pw's assertion was weak, write the real expected result (row, values, message).
3. Ask QA for the module's sheet (users came as `AD_Users`; scheme ids `st_AD_SCH_*` suggest the same tool). Map sheet cases → criteria in `docs/test-case-coverage.csv`, as for users. Sheet cases pw never had become new criteria.
4. Add a "pw source" line to the spec header (`tests/state.spec.ts TC1–TC17`) so the history is traceable.
5. Review, then mark ready to implement.

### Phase 3: Implement, module by module

Order (simple and reusable first, so components are proven early):

| Wave | Modules | Why |
| --- | --- | --- |
| 1 (pilot) | states | Smallest full CRUD list page; proves `DataTable`, unique names, cleanup, `TEST_ENV` |
| 2 | districts, cities, warehouse-types, outlet-types, outlet-categories, headquarters | Same list-page pattern; headquarters reuses `createTestUser` |
| 3 | products (sku), collaterals, pops | Uploads, filters; sku page object ports as is |
| 4 | reasons, disclaimers | Cross-role (`loginAs`), order rejection on own order |
| 5 | admin-schemes, staggered-qps | `schemes` project; extended `SalePage`; data-driven cases; real benefit assertions |
| 6 | forevery-qps | Blocked until distributor login + QA steps exist; built fresh, not ported |

Per module: `spec:check` green, run headed on the target environment, known app bugs as `test.fail` + TODO.md, status → Implemented.

### Phase 4: Retire pw

When a module is Implemented in bizom-e2e, mark it migrated in pw's README and stop running it there. When all are done (forevery may stay blocked), archive the pw repo. Keep pw runnable until then so coverage never drops.

---

## 8. Decisions needed

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Which environment do the new modules run on: devauto, devarun, or both? | Support both through `TEST_ENV`; verify each module on devauto first (its data is there). Masters can move to devarun cheaply; schemes need the QPS products and outlets set up |
| D2 | Prefix and folder names in section 6 | Accept, or rename before the first spec is written |
| D3 | May we drop the 12 DROP tests (duplicates, scaffold, "close browser", TC18 mass-disable)? | Yes; each is listed with its reason in the inventory |
| D4 | Scheme tests create invoices and use stock: which environments allow that? | `schemes` project, opt-in, `@destructive`, never in the default run |
| D5 | Admin scheme DM sales sell 3 units against a 4-unit slab and often exclude the sold SKU. What should the sale show? | Ask QA per case before writing SCHS criteria |
| D6 | Who changes the passwords exposed in pw's files? | Raise with the pw owners now, independent of the merge |
| D7 | Allure: keep or not? | JUnit now (for CI); Allure only if the team uses run history |
| D8 | Second admin (`adminAlt`) is the same user as admin with another password | Drop it; use the admin role |
