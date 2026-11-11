# User lifecycle: login, password change, deactivate / reactivate

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Module      | Users                                                        |
| ID prefix   | `ULIFE`                                                      |
| Status      | Implemented (criteria awaiting team review)                  |
| Tests       | `tests/users/user-lifecycle.spec.ts`                         |
| Users       | **`data/automationUsers.ts`** (one automation account per role) |
| Environment | `BASE_URL` from `.env` (dev: devarun)                        |

## Purpose

Users an admin created can actually use their account: they log in, change their own password, and log in with the new one. The admin can then deactivate them and bring them back from the Inactive list. Checked for one account of **every** role.

This spec only checks *whether* a user can log in. Where each role lands and what it sees after login is still to do (see `TODO.md`); the landing pages seen so far are recorded in `data/automationUsers.ts`.

## Preconditions & test data

- Admin logged in via the `authedPage` fixture. Each user logs in in a separate browser (`loginAs` fixture), so the admin stays logged in.
- **Automation users:** the accounts in `data/automationUsers.ts`. Every username starting with `e2e.` is an automation user; the tests change their passwords and status on every run.
- **Passwords are new on every run**: the app refuses any of a user's last 3 passwords ("Last 3 password(s) can not be used. Please type a new password!"). Each run makes two (`freshPassword()`, prefix `E2E_USER_PASSWORD_PREFIX` from `.env`): the admin sets the first, the user changes it to the second.
- For each role the two tests run in order (password, then active status) in the same worker.

## Pages & URLs

| Page              | URL                    | Key elements |
| ----------------- | ---------------------- | ------------ |
| Edit user (admin) | `/users/edit/<id>`     | **Change Password** (sets this user's password), **active** checkbox, **Save** |
| Users list        | `/users/ajaxuserindex` | Active / Inactive / All Users filter, Search, username link; "The user has been saved" after Save |
| User details      | `/users/view/<id>`     | Opened by clicking the username in the list; **Edit** |
| User menu         | `person` icon          | **Change Password** → "Password Change" dialog: Old, New, Confirm Password |

## Web login per role (seen 10 Nov 2026)

| Role | Web login |
| ---- | --------- |
| SALESMAN | **Refused** with "Invalid request url.", even with the right password; the existing `Raghav.Salesman` is refused the same way. Presumably mobile-app only; awaiting product confirmation. Its password criteria (ULIFE-03/04) can't run. |
| ERP API User | **Known issue:** login loops between `/users/dashboard` and `/users/customroledashboard` until the browser gives up (too many redirects). Tested as an expected failure. |
| All others | Log in. |

## Acceptance criteria

### ULIFE-01 Admin sets the user's password

- **Given** the user's Edit page (if a previous run stopped while the user was inactive, the admin makes it active first)
- **When** the admin clicks **Change Password**, enters a new password twice and confirms
- **Then** the app says "Successfully changed password"

### ULIFE-02 The user can log in

- **When** the user logs in with that password
- **Then** they are in the app (not on the login page; "Welcome" banner and user icon shown)
- **For roles whose web login is refused:** they stay on the login page with the configured message

### ULIFE-03 The user can change their own password

- **Given** the user is logged in
- **When** they open user menu → **Change Password**, enter the old password and another new password twice, and click **Change Password**
- **Then** the app says "Successfully changed password"

### ULIFE-04 Only the new password works

- **When** the user logs in with the old password
- **Then** they stay on the login page and are not logged in
- **When** they log in with the new password
- **Then** they are in the app

### ULIFE-05 Admin can mark the user inactive

- **When** the admin opens the user's Edit page, unticks **active** and clicks **Save**
- **Then** the users list shows "The user has been saved"
- **And** searching under **Active Users** doesn't find the user
- **And** under **Inactive Users** the user is listed with Status "Inactive"

### ULIFE-06 Admin can reactivate the user from the Inactive list

- **Given** the users list shows **Inactive Users**
- **When** the admin clicks the user's username
- **Then** the user details page `/users/view/<id>` opens with an **Edit** button
- **When** the admin clicks **Edit**, ticks **active** and clicks **Save**
- **Then** the users list shows "The user has been saved"
- **And** under **Active Users** the user is listed with Status "Active"

## Out of scope (see `TODO.md`)

- Landing page and what each role sees after login.
- An inactive user being unable to log in.
- Password rules in the Change Password dialog (wrong old password, mismatch, contains username).
