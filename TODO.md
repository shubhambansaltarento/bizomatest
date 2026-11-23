# TODO: admin & user management tests

Tracks what is covered and what is still to do. Tick an item when its test is in and green; link the criterion ID. New items go under the matching heading.

Specs: [admin home & navigation](specs/admin/admin-home-navigation.md) · [users list](specs/users/users-list.md) · [add user](specs/user-creation/add-user.md) · [add user validation](specs/user-creation/add-user-validation.md) · [add user form](specs/user-creation/add-user-form.md) · [user images (config)](specs/user-creation/config/user-images.md) · [edit user](specs/users/edit-user.md) · [user password & status](specs/users/user-password-status.md) · [designation column (config)](specs/users/config/user-designation-column.md) · [user details](specs/users/user-details.md) · [user block](specs/user-block/progressive-lockout.md)
Role config for Add User: [`data/userRoles.ts`](data/userRoles.ts)
Cases from the users sheet that belong to other modules: [`TODO-later-user-module.md`](TODO-later-user-module.md)
Automation users (every `e2e.*` username): [`data/automationUsers.ts`](data/automationUsers.ts)

## App issues found (raise with product / dev)

- [ ] **Blank username is sent to the server** (Add User, 16 Nov 2026): clear the username after the check and click Add; nothing in the browser stops it, and the server answers "Username already taken, please try with other name" on an emptied form. No user is created. Tested as a known issue (UFORM-03).
- [ ] **Image limit shown too late** (Edit user, attendanceFaceVerification = 1, 16 Nov 2026): right after the 5th image the file input is still offered and "No more uploads allowed" is missing; it only shows when a 6th is tried or after reopening. Tested as a known issue (UIMG-05).
- [ ] **Edit saves a blank name** (Edit user, 17 Nov 2026): clear Name (or enter only spaces) and Save; "The user has been saved" and the user has no name. Add User refuses it ("Name is a mandatory field"). Tested as a known issue (UEDIT-04).
- [ ] **Role saved without its mapping when Save is quick** (Edit user → Edit Role, 17 Nov 2026): pick ZONE MANAGER and click Save before the ZONE dropdown has loaded (under a second); "The user has been saved" with no zone. Once the dropdown is shown, Save is refused ("Please select Role details"). The check should not depend on the dropdown being drawn. The test waits for the dropdown (UEDIT-05).
- [ ] **Login / Logout Details not updated** (user details page, 17 Nov 2026): "Last Login Date Time" and "Last Logout Time" stay empty / "N/A" after a web login and logout; the main admin's still show 2026-08-28. The sheet's precondition is "Custom branch should be available": is the feature missing from devarun's build? Tested as a known issue (UVIEW-03/04).
- [ ] **QA sheet vs app: progressive lockout** (17 Nov 2026): the sheet expects the first block at the 5th wrong password; devarun blocks from the 3rd ("blocked for next 3 minutes"), and wrong passwords tried while blocked still count. Ask QA which is right (UBLK-02).
- [ ] **Designation can't be changed on Edit** (17 Nov 2026): the dropdown is disabled, also after Edit Role; it can only be set on Add User. Intended?
- [ ] **QA sheet vs app (users, 17 Nov 2026):** TC8991 updates the username, but it is read-only on Edit; TC9512 expects "Please enter valid password!", the web shows "Password Not Valid"; TC9002 expects an "inactive user" message, the web shows "Invalid username or password."; TC10613/10614 need a user without a role, which the web doesn't allow. Ask QA to update the sheet or explain.
- [ ] **Set Outlet Targets is broken** (Dashboard → Set Outlet Targets, `/outlettargets/settarget`, 10 Nov 2026): "jQuery is not defined", page has no navbar, sidebar or styles. Tested as a known issue (ADM-02); remove it from `sidebarKnownIssues` in `data/roles.ts` once fixed.
- [ ] **New Scheme link redirects** (`/schemes/add` → `/schemes/addscheme`), and the sidebar then loses its section. Could link straight to the final URL.
- [ ] **Username check accepts illegal characters**: "User name is Available" for `e2e bad#1`; only Add rejects it (UVAL-01).
- [ ] **SALESMAN can't log in to the web app**: "Invalid request url." even with the right password (also for the existing `Raghav.Salesman`). Confirm it's by design (mobile only). If so, keep it as `refused` in `data/automationUsers.ts`.
- [ ] **ERP API User login loops** between `/users/dashboard` and `/users/customroledashboard` (too many redirects). Tested as a known issue (ULIFE-02).
- [ ] User menu → **Change Password** opens as a bare, unstyled page (`/users/changepwddialog`) when clicked before the page's scripts are ready (seen on several landing pages); the tests retry. A slow page makes this visible to real users too.
- [ ] **Successful login leaves an "Invalid request url." flash** (23 Nov 2026, discovery): after a correct admin login, the first page opened shows the red "Invalid request url." banner (`#flash-message`) although it loads fine. In a session reused for a while the same banner kept showing on every page, including `/users/ajaxuserindex` and `/users/dashboard`. Discovery records it as an app message, not a page error.
- [ ] Wrong-password message differs by user: "Invalid User credentials.." for the main admin, "Invalid request url." for e2e users.
- [ ] Empty password gives "Please add User Password", but typing then clearing it gives "Please Enter a Valid password" (UVAL-03).

- [ ] **Login error banner gone** (seen 10 Nov 2026, after the dev server's maintenance window): a wrong password or unknown user now shows the message only under the form ("Invalid User credentials.."), not in the top `#flash_message` banner, so AUTH-03/04 fail. Confirm whether this is intended, then update `specs/auth/login-logout.md` and `LoginPage.errorMessage`.

## 1. Admin login redirection assertion

- [x] After login, admin lands on `/users/ajaxuserindex` (AUTH-01, ADM-01)
- [x] Banner reads "you are ADMIN" and the users table loads (ADM-01)
- [x] Sidebar opens on the Dashboard section with Users in it (ADM-01)
- [x] Every sidebar item (Dashboard, Inventory, Products, Discounts) opens its own page, stays logged in, shows no error (ADM-02); Set Outlet Targets is a known issue (see above)
- [ ] Reports: open the section and every report it lists (items load only when Reports is opened)
- [ ] Top navbar global Search (User / Outlet)
- [ ] Notifications icon (megaphone) opens and lists notifications
- [ ] User menu items: Settings, Billing, Change Password, Contact Support open the right page (ROLE-04 only checks they are listed)
- [ ] Logged-in admin opening a blocked/unknown URL gets a clear message, not a server error
- [ ] Session timeout / auto logout (`auto_logout_event_listener.js`)
- [ ] Make the test suite wait out / detect the dev server's maintenance page ("Updates in Progress") and report it as environment-down instead of test failures

## 2. Add user

Module **user-creation** (`npm run test:user-creation`, config: `npm run test:user-creation:config`). QA sheet cases and the criterion for each: [`data/userModuleCases.ts`](data/userModuleCases.ts) (area "User creation"); status per case: [`docs/user-module/user-module-test-coverage.xlsx`](docs/user-module/user-module-test-coverage.xlsx).

- [x] All 29 web cases of the sheet have a test (UADD, UVAL, UFORM, UIMG); 2 are known app bugs (UFORM-03, UIMG-05)
- [ ] User custom fields order (UFORM-13, TC9442/TC9443): needs user custom fields on devarun (Settings → Form Settings → User Form)

- [x] Role list in a config file: `data/userRoles.ts` (13 roles, with the zone / warehouse / area each needs)
- [x] Taken username is refused, also in other case (UADD-01)
- [x] Free username shows the Role dropdown with exactly the configured roles (UADD-02)
- [x] Create one user for every role, then find it in the list with the right role, name and status (UADD-03)
- [ ] **Clean up created users**: UADD-03 adds 13 `e2e.*` users per run. Deactivate them after the test (now easy: `UserEditPage.saveActive(false)`), or reuse the automation users instead of creating new ones
- [ ] Create the automation users of `data/automationUsers.ts` automatically when missing (needed for any environment other than devarun)
- [ ] Log in as each newly created user and check the landing page / banner (ties into `data/roles.ts`); REPORT ADMIN done (UFORM-14)
- [ ] Fill optional fields: phone, email, Gmail, address, IMEI, designation, employee ID, date of birth; check they show on Edit (phone, designation and date of birth input are tested: UFORM-06..10)
- [ ] Pick a **Reporting To** manager and check it is saved (today the test answers OK to "continue without a reporting manager?")
- [ ] Map one user to several zones / warehouses / areas (the dropdowns are multi-select)
- [ ] ADMIN "Integration Admin" checkbox and its Get / Post / All method
- [x] User images: minimum 3, maximum 5, saved without 5xx (UIMG-01..05, `attendanceFaceVerification` per user)
- [ ] Per-environment mapping data if tests run outside devarun (zones/warehouses in `data/userRoles.ts` are devarun's)

## 2b. User login (automation users)

- [x] Every role's automation user can log in, or is refused as configured (ULIFE-02)
- [x] User changes their own password; the old one stops working and the new one works (ULIFE-03/04)
- [ ] **Landing page per role**: assert the page each role lands on after login (seen values are in `data/automationUsers.ts` → `landingPath`)
- [ ] **Login assertions per role**: banner "you are <ROLE>", sidebar sections, user menu (extend `data/roles.ts` to every role, so ROLE-01..05 run for them)
- [ ] Inactive user can't log in (and gets a clear message)
- [ ] Change Password dialog validation: wrong old password, new ≠ confirm, password containing the username, too short, one of the last 3 passwords ("Last 3 password(s) can not be used. Please type a new password!")
- [ ] SALESMAN / DISTRIBUTOR SALESMAN on the mobile app (out of web scope)

## 3. Manage user

- [x] Users list: controls and columns (ULIST-01)
- [x] Active / Inactive / All filter matches the counts (ULIST-02)
- [x] Pagination: First / Previous / Next / Last / page number (ULIST-03); page size 25 → 10 (USR-01/02)
- [x] Search, including no match and clearing it (ULIST-04)
- [x] Sort by User Name, both directions (ULIST-05)
- [x] Row actions: Edit, map marker, Pjp link to the row's user and open (ULIST-06)
- [x] Download gives `User_List_<date>.csv` (ULIST-07)
- [x] New User opens the Add User form (ULIST-08)
- [x] Edit → Change Password dialog opens (USR-03/04)
- [x] Download: columns, and the users of each status filter (ULIST-09)
- [x] No DataTables warning on load / search / clear (ULIST-10); /users and /users/dashboard open (ULIST-11)
- [x] User details page: opens from the list, no 5xx on reload / Home (UVIEW-01/02); last login / logout time (UVIEW-03/04, known issue)
- [ ] Sort by the other columns
- [ ] "…[ + ]" in the For column shows all mappings
- [x] Edit a user: name / email / address / employee ID saved and shown (UEDIT-01/02); invalid email refused (UEDIT-03); blank name refused (UEDIT-04, known bug)
- [x] Edit Role: change role, missing mapping refused (UEDIT-05); DSM Reporting To kept (UEDIT-06)
- [x] Admin Change Password: dialog opens clean, invalid password refused (UPST-01/02); inactive user can't log in (UPST-03)
- [x] Designation column with attendance_audit off / on (UDES-01/02, config)
- [ ] Settings → Form Settings → User Form: success message on Update (TC9563, TC9567). Needs `isusercustomized` = 1 (company-wide, off on devarun)
- [x] Progressive lockout: wrong passwords 1–2, blocks from the 3rd, right password refused while blocked, login after the block (UBLK-01..04, `npm run test:user-block`)
- [ ] 10th wrong password (blocked for good) and admin Unblock (TC10606, TC10595): needs `unblockuser`; left out on purpose (max 9 attempts)
- [ ] Inactivate a user with duplicate IDs in the managed list (TC10612): steps unclear
- [x] Deactivate a user from Edit → listed under Inactive (ULIFE-05)
- [x] Reactivate from Inactive Users → username → details → Edit → active (ULIFE-06)
- [ ] Active / Inactive counts change when a user is deactivated / reactivated
- [ ] Change another user's password and log in with it (SALE-02 does this for one DM)
- [ ] Update Bill Sequence No and Remove Picture & Location on Edit
- [ ] Pjp page: assign / update a PJP
- [ ] Map view: shows the user's last location

## 4. Validation in adding user

- [x] Username with illegal characters (UVAL-01)
- [x] Name empty or only spaces (UVAL-02)
- [x] Password empty (UVAL-03)
- [x] Password too weak: too short, no special character (UVAL-04)
- [x] No role (UVAL-05)
- [x] Role without its mapping: ZONE MANAGER without zone, SALESMAN without area (UVAL-06)
- [x] Rejected form is not saved and keeps its values (UVAL-07)
- [ ] Password rule edge cases: no upper case, no lower case, no digit, exactly 6 characters
- [ ] Invalid phone number ("Enter valid phone number")
- [ ] Invalid / duplicate email and Gmail ID ("Enter valid Email id", "Duplicate Gmail id.")
- [ ] Duplicate IMEI ("Duplicate Device ID!")
- [ ] Invalid / duplicate employee ID
- [ ] Date of birth in the future ("Date should not be greater than today date")
- [ ] Username longer than 191 characters (field max length)
- [ ] Two users submitted with the same username at once (server-side duplicate check)

## 5. Login test sheet (`docs/login test cases.xlsx`)

- [x] Spaces around username / password are ignored; Google sign-in shown (AUTH-09..11)
- [x] Rows 7, 10: 24-hour password lock (LCFG-01..03, `npm run test:config`)
- [ ] Rows 47, 14, 17, 30, 32 (forced logout, first-login reset, expiry alerts) don't happen on the web: LCFG-04..08 are expected failures. Confirm with product whether they are app-only.
- [ ] Ask product: the 24-hour lock also blocks the **admin** from resetting the user's password (LCFG-02). Intended?
- [ ] 20 mobile-only cases: `docs/mobile-login-test-cases.xlsx` (manual, or a future mobile suite). Rows 22–26 need their steps recovered from the source.
