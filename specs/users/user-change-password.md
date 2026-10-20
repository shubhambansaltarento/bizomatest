# User list → Edit → Change Password

| Field       | Value                                          |
| ----------- | ---------------------------------------------- |
| Module      | Users                                          |
| ID prefix   | `USR`                                          |
| Status      | Implemented                                    |
| Tests       | `tests/users/user-change-password.spec.ts`     |
| Environment | `BASE_URL` from `.env` (dev: devarun)          |

## Purpose

An admin browses the users list, narrows it to 10 entries per page, opens a user for editing, and opens the Change Password dialog for that user. The flow stops at the open dialog: no password is entered or changed.

## Preconditions & test data

- Logged in via the `authedPage` fixture (AUTH-01 before, AUTH-02 after; see `specs/auth/login-logout.md`).
- The logged-in user is an admin who can see and edit other users.
- At least 2 users exist (dev currently has 23).
- The user to edit is picked **at random** from the rows visible on page 1, **excluding the logged-in user**, so the shared login account is never touched. The chosen user is recorded in the test report.

## Pages & URLs

| Page                   | URL                          | Key elements                                                                                           |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Users list             | `/users/ajaxuserindex`       | Users table (`User ID`, `User Name`, … `Actions`), **Show N entries** selector (10 / 25 / 50 / 100), "Showing X to Y of Z entries" |
| Edit user              | `/users/edit/<userId>`       | Username (read-only), **Change Password** button (top right of the form)                               |
| Password Change dialog | dialog on the Edit page      | Title "Password Change", **New Password(\*)**, **Confirm Password(\*)**, Cancel, Change Password       |

> The Edit page also has a "Change Password" item in the navbar user menu. That one changes the **logged-in user's own** password and is not part of this flow.

## Acceptance criteria

### USR-01 Users list shows 25 entries per page by default

- **Given** I am logged in
- **When** I open `/users/ajaxuserindex`
- **Then** the users table is visible
- **And** the page-size selector shows 25
- **And** the table shows `min(25, total)` rows, matching "Showing 1 to `min(25, total)` of `total` entries"

### USR-02 Page size can be changed to 10

- **Given** I am on the users list
- **When** I choose 10 in the page-size selector
- **Then** the table shows `min(10, total)` rows
- **And** the summary reads "Showing 1 to `min(10, total)` of `total` entries", with `total` unchanged

### USR-03 Edit opens the selected user

- **Given** the users list shows 10 entries per page
- **When** I pick a random user from the visible rows (not the logged-in user) and click its **Edit** button
- **Then** I am on `/users/edit/<that user's ID>`
- **And** the Username field shows that user's username

### USR-04 Change Password opens the password dialog for that user

- **Given** I am on the Edit page of the selected user
- **When** I click **Change Password**
- **Then** the "Password Change" dialog is shown
- **And** the New Password and Confirm Password fields are visible and empty
- **And** nothing is submitted (the flow stops here)

## Out of scope

- Entering or submitting a new password, password complexity rules, Cancel/Close behaviour.
- Pagination beyond page 1, sorting, searching.
- Editing any other user field.
