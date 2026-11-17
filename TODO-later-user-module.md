# TODO later: cases from the user sheet that belong to other modules

These 7 web cases are in the users QA sheet (`docs/TestCases_11-11-26-07_45_22.csv`) but test other modules. They are parked here, not in the user module, and will be picked up when those modules are automated. They are in `data/userModuleCases.ts` as area "Other module"; coverage per case: `docs/user-module/user-module-test-coverage.xlsx` (`npm run coverage:users`).

Parked on 17 Nov 2026.

## Sales report (sales / reports module)

- [ ] **TC9434** Sales Report is refreshed automatically after a sale.
  DM logs in and places a sale for today; admin opens User View → Sales Report; the new sale is shown without a manual refresh.
  Needs: a DM who can place a sale (SALE-02/03 already do this for one DM), and the Sales Report page under User View.
- [ ] **TC9435** Sales Report is not refreshed after a sale (the bug case of TC9434).
  Same steps, then refresh manually: the data before and after the refresh must be the same.
  Can share one test with TC9434.

## Outlets (outlets module)

- [ ] **TC9451** A user changes an outlet's type and submits it; the approver approves or rejects it.
  Sheet uses DS_Abishek (requester), WM_Guruswamy (approver), outlet 221 and `/users/approveEditRequest` on another tenant (devrunique).
  Needs: setting `editApproval` on, an approver mapped to the requester, an outlet on devarun, and two logins.
- [ ] **TC9472** Approve / Reject doesn't freeze when the outlet type change can't be handled (requester and approver in inconsistent hierarchies).
  Needs: the same as TC9451 plus a broken hierarchy; ask QA how to set it up.

## Warehouses (warehouses module)

- [ ] **TC9568** Warehouse Edit page loads (`/warehouses/edit/<id>`), fields filled in, a small edit saves and shows after reopening.
  Easy on its own; needs a warehouse that's safe to edit (e.g. one created by the test).

## Login: forgot password

- [ ] **TC9438** (titled "NA" in the sheet) Forgot Password with an unregistered username or email / phone gives a clear "user not found" message, not a 504 Gateway Timeout; a registered username works normally.
  Belongs with the login tests (`specs/auth/`). Ask QA to give it a title.

## Single sign-on (SSO configuration)

- [ ] **TC9448** An invalid Microsoft email format is refused in the SSO configuration ("Microsoft Mail" field), and Microsoft sign-in fails with a clear message.
  Sheet uses the BAT Global portal. Microsoft sign-in is not set up on devarun (`LoginPage.microsoftSignIn` is not shown), so this needs an environment with SSO.
