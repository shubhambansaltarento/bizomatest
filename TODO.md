# TODO: admin & user management tests

Tracks what is covered and what is still to do. Tick an item when its test is in and green; link the criterion ID. New items go under the matching heading.

Specs: [admin home & navigation](specs/admin/admin-home-navigation.md) · [users list](specs/users/users-list.md) · [add user](specs/users/add-user.md) · [add user validation](specs/users/add-user-validation.md)
Role config for Add User: [`data/userRoles.ts`](data/userRoles.ts)
Automation users (every `e2e.*` username): [`data/automationUsers.ts`](data/automationUsers.ts)

## App issues found (raise with product / dev)

- [ ] **Set Outlet Targets is broken** (Dashboard → Set Outlet Targets, `/outlettargets/settarget`, 10 Nov 2026): "jQuery is not defined", page has no navbar, sidebar or styles. Tested as a known issue (ADM-02); remove it from `sidebarKnownIssues` in `data/roles.ts` once fixed.
- [ ] **New Scheme link redirects** (`/schemes/add` → `/schemes/addscheme`), and the sidebar then loses its section. Could link straight to the final URL.
- [ ] **Username check accepts illegal characters**: "User name is Available" for `e2e bad#1`; only Add rejects it (UVAL-01).
- [ ] **SALESMAN can't log in to the web app**: "Invalid request url." even with the right password (also for the existing `Raghav.Salesman`). Confirm it's by design (mobile only). If so, keep it as `refused` in `data/automationUsers.ts`.
- [ ] **ERP API User login loops** between `/users/dashboard` and `/users/customroledashboard` (too many redirects). Tested as a known issue (ULIFE-02).
- [ ] User menu → **Change Password** opens as a bare, unstyled page (`/users/changepwddialog`) when clicked before the page's scripts are ready (seen on several landing pages); the tests retry. A slow page makes this visible to real users too.
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

- [x] Role list in a config file: `data/userRoles.ts` (13 roles, with the zone / warehouse / area each needs)
- [x] Taken username is refused, also in other case (UADD-01)
- [x] Free username shows the Role dropdown with exactly the configured roles (UADD-02)
- [x] Create one user for every role, then find it in the list with the right role, name and status (UADD-03)
- [ ] **Clean up created users**: UADD-03 adds 13 `e2e.*` users per run. Deactivate them after the test (now easy: `UserEditPage.saveActive(false)`), or reuse the automation users instead of creating new ones
- [ ] Create the automation users of `data/automationUsers.ts` automatically when missing (needed for any environment other than devarun)
- [ ] Log in as each newly created user and check the landing page / banner (ties into `data/roles.ts`)
- [ ] Fill optional fields: phone, email, Gmail, address, IMEI, designation, employee ID, date of birth; check they show on Edit
- [ ] Pick a **Reporting To** manager and check it is saved (today the test answers OK to "continue without a reporting manager?")
- [ ] Map one user to several zones / warehouses / areas (the dropdowns are multi-select)
- [ ] ADMIN "Integration Admin" checkbox and its Get / Post / All method
- [ ] User images (max 5; minimum 3 when the setting requires it)
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
- [ ] Download: check the CSV's columns and that its rows match the list
- [ ] Sort by the other columns
- [ ] "…[ + ]" in the For column shows all mappings
- [ ] Edit a user: change name / phone / email / mapping and Save; check the list shows it
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
