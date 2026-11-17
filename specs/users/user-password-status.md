# Admin sets a user's password; inactive users can't log in

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Module      | Users                                                        |
| ID prefix   | `UPST`                                                       |
| Status      | Implemented (criteria awaiting team review)                  |
| Tests       | `tests/users/user-password-status.spec.ts`                   |
| Source      | QA sheet `docs/TestCases_11-11-26-07_45_22.csv` (case codes per criterion) |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 17 Nov 2026   |

## Purpose

The **Change Password** dialog on a user's Edit page opens cleanly, refuses a password that breaks the rules, and accepts a valid one. Once the user is made inactive, that password no longer logs them in. A successful password change and deactivation for each role are in `user-lifecycle.md` (ULIFE).

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- The test creates its own REPORT ADMIN user (`createTestUser`, prefix `e2e.`); the criteria run in order on that user, which ends inactive.
- The user logs in in a separate browser (`loginAs`).

## Pages & URLs

| Page                   | URL                | Key elements |
| ---------------------- | ------------------ | ------------ |
| Edit user              | `/users/edit/<id>` | **Change Password**, **active**, **Save** |
| Password Change dialog | on the Edit page   | Line "All form fields are required." (replaced by the error), New Password(\*), the rules it still misses, Confirm Password(\*), "password complexity" list, Cancel, Change Password |
| Login                  | `/users/login`     | Error message under the form |

## Acceptance criteria

### UPST-01 The Change Password dialog opens without errors

Sheet: TC10613, TC10614.

- **When** I click **Change Password** on an active user's Edit page
- **Then** the "Password Change" dialog shows "All form fields are required.", empty New and Confirm Password fields, and the "password complexity" list
- **And** no error is shown and no server error (5xx) occurs

> The sheet asks for a user **without an assigned role**. On the web every user has a role (Role is mandatory on Add and Edit), so a user with a role is used. Asked the team how to get a user without one (`TODO.md`).

### UPST-02 An invalid password is refused

Sheet: TC9512.

- **When** I enter `abc` as New and Confirm Password and click **Change Password**
- **Then** the dialog says "Password Not Valid", lists what is missing ("Minimum 6 Characters requires, 1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,"), and stays open
- **When** I enter a valid password twice and click **Change Password**
- **Then** an Alert says "Successfully changed password"

> **Differs from the sheet:** TC9512 expects "Please enter valid password!". The web shows "Password Not Valid" with the list of missing rules.

### UPST-03 An inactive user can't log in

Sheet: TC9002.

- **Given** the user has the password set in UPST-02
- **When** the admin unticks **active** and saves, and the user logs in with that password
- **Then** the user stays on the login page with "Invalid username or password." and is not logged in

> The sheet expects an "Invalid/Inactive user credentials" message; the web shows the same message as for a wrong password.

## Out of scope

- Passwords that differ from the confirmation, or contain the username (seen: "Password and confirmation must be same", "Password Not Valid").
- An inactive user's password can't be changed ("User is inactive!", seen 17 Nov 2026).
