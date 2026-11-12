# Login settings (config)

| Field       | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Module      | Config (Authentication)                                           |
| ID prefix   | `LCFG`                                                            |
| Status      | Implemented (criteria awaiting team review)                       |
| Tests       | `tests/config/login-settings.spec.ts` (run: `npm run test:config`) |
| Settings    | `data/settings.ts`, changed through the `appSettings` fixture      |
| Source      | Team sheet `docs/login test cases.xlsx`, rows 7, 10, 14, 17, 30, 32, 47 |
| Environment | `BASE_URL` from `.env` (dev: devarun)                              |

## Purpose

Login and password behaviour that only happens when a setting is switched on. The cases come from the team's login sheet, where they are written for the mobile app; this spec covers what the **web** app does with the same settings.

## How config tests work

- Settings are on **Settings → All Settings** (`/settings/allsettings`), which **only an ADMIN can open**.
- Tests change them only through the `appSettings` fixture (`fixtures/settings.fixture.ts`). It logs in as admin in its own browser, edits the value, clicks **Review**, then **Save** (the app answers "Please logout and re-login for the changes to reflect."), and after the test puts every changed setting back to the value it had before, also when the test fails or times out.
- Settings that can be set for one user (`level: 'user'` in `data/settings.ts`) are set only for the test's own user. `passwordresetlock`, `forceLogoutOnPasswordChange` and `changepasswordnotification` exist only for the whole company: while they are switched on, everyone on the server is affected.
- So these tests run on their own, one at a time: `npm run test:config`. The normal suite (`npx playwright test`) leaves them out.

## Preconditions & test data

- Each test creates its own user: an automation user (`e2e.reportadmin.<suffix>`, role REPORT ADMIN, which logs in to the web and has no mapping). It is deactivated at the end of the test.
- Passwords come from `freshPassword()` (the app refuses a user's last 3 passwords).
- On dev all of these settings are off (see `data/settings.ts`).

## Pages & URLs

| Page              | URL                      | Key elements |
| ----------------- | ------------------------ | ------------ |
| All Settings      | `/settings/allsettings`  | Default Settings (company), Role Wise Settings → role → untick **For All Users** → user; **Review**, **Save** |
| Edit user (admin) | `/users/edit/<id>`       | **Change Password** |
| User menu         | `person` icon            | **Change Password** |
| Warning banner    | any page                 | Orange bar under the navbar (`#warning_message`) |

## Acceptance criteria

### LCFG-01 With the 24-hour lock, a user can't change their password again

Sheet row 7. Checked on dev on 12 Nov 2026.

- **Given** `passwordresetlock` is 1, and the user's password was changed within the last 24 hours (the admin just set it)
- **When** the user logs in and opens user menu → **Change Password**
- **Then** no Password Change dialog opens; the page reloads with the warning "Password was changed in the last 24 hours. Please wait 24 hours to change the password again"

### LCFG-02 With the 24-hour lock, the admin can't change that user's password either

Not in the sheet; seen while checking row 7.

- **Given** the same user and setting
- **When** the admin opens the user's Edit page and clicks **Change Password**
- **Then** no dialog opens; the page reloads with the same warning

### LCFG-03 The lock message says 24 hours, not 6

Sheet row 10.

- **Then** the warning in LCFG-01 and LCFG-02 says "24 hours" and does not mention 6 hours

### LCFG-04 Changing a user's password logs them out

Sheet row 47.

- **Given** `forceLogoutOnPasswordChange` is 1 and the user is logged in
- **When** the admin changes the user's password
- **Then** the user's next page is the login page (on the app: a screen asking for the new password), not the app

> **Not on the web (12 Nov 2026):** the user stays logged in: after the change, reloading and opening other pages work as before. Kept as an *expected failure* until product confirms whether the web should log the user out (then it is a bug) or this is app-only.

### LCFG-05 A new user is asked to reset their password on first login

Sheet row 14.

- **Given** `initialPasswordReset` is 1 for a user who has never logged in
- **When** the user logs in for the first time
- **Then** they are asked to set a new password before using the app

> **Not on the web (11 Nov 2026):** the first login goes straight to `/users/dashboard`. Expected failure until product confirms (see LCFG-04).

### LCFG-06 That first reset is not blocked by the 24-hour lock

Sheet row 17.

- **Given** `initialPasswordReset` is 1 for a new user and `passwordresetlock` is 1
- **When** the user logs in for the first time
- **Then** they are asked to set a new password, and no "Password was changed in the last 24 hours" warning is shown

> Depends on LCFG-05, so it fails on the web for the same reason. Expected failure.

### LCFG-07 Alert 1 day before the password expires

Sheet row 30.

- **Given** `password_ageing_days` is 1 for the user, `changepasswordnotification` is `{"enable": 1,"alert_days": [3,1]}`, and the user's password was just set (so it expires in 1 day)
- **When** the user logs in
- **Then** an alert says "Password reset is due in 1 day!"

> **Not on the web (12 Nov 2026):** no alert, neither in the page nor as a browser pop-up. Expected failure until product confirms (see LCFG-04).

### LCFG-08 Alert 3 days before the password expires

Sheet row 32.

- **Given** as LCFG-07, but `password_ageing_days` is 3 (the password expires in 3 days)
- **When** the user logs in
- **Then** an alert says "Password reset is due in 3 days!"

> Not on the web, as LCFG-07. Expected failure.

## Questions for product

- LCFG-04..08: the web does none of these. Are they meant for the mobile app only? If so, they move to `docs/mobile-login-test-cases.xlsx`; if the web should do them, they are bugs and stay here as expected failures until fixed.
- LCFG-02: the 24-hour lock also stops the **admin** from resetting a user's password (for example, a user who forgot the password they set an hour ago). Intended?
- After an admin changes a logged-in user's password, the user's next page sometimes shows "Invalid request url." in a banner, while still working normally.

## Out of scope

- The mobile app versions of these cases (`docs/mobile-login-test-cases.xlsx`).
- Other settings: add them to `data/settings.ts` and a spec under `specs/config/` when needed.
