# Edit user

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Module      | Users                                                        |
| ID prefix   | `UEDIT`                                                      |
| Status      | Implemented (criteria awaiting team review)                  |
| Tests       | `tests/users/edit-user.spec.ts`                              |
| Source      | QA sheet `docs/TestCases_11-11-26-07_45_22.csv` (case codes per criterion) |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 17 Nov 2026   |

## Purpose

An admin opens an existing user's Edit page, changes their details or role, and saves; the changes show on the user's details page and when the Edit page is opened again. Wrong values are refused with an Alert. Password and active status on the same page are in `user-password-status.md` (UPST) and `user-lifecycle.md` (ULIFE).

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- Each test creates its own user (`createTestUser` in `fixtures/testUsers.ts`, prefix `e2e.`), edits it, and deactivates it at the end.
- UEDIT-06 uses the fixed automation user E2E SALES MANAGER (`data/automationUsers.ts`) as reporting manager; it is only picked, not changed.

## Pages & URLs

| Page         | URL                 | Key elements |
| ------------ | ------------------- | ------------ |
| Users list   | `/users/ajaxuserindex` | **Edit** in the Actions column; "The user has been saved" after Save |
| Edit user    | `/users/edit/<id>`  | Heading "Edit User", username (read-only), Name, Phoneno, Email, Gmail ID, Address, IMEI, Employee Id, Date of Birth, Designation (disabled), active, Role as text with **Edit Role**, **Save** |
| Edit Role    | same page           | Role dropdown, the role's mapping dropdowns (filled with the current mapping), **Select Reporting To** |
| User details | `/users/view/<id>`  | Table: Username, Name, Employee ID, Email, Address, Role, For, Hierarchy |

## Acceptance criteria

### UEDIT-01 Edit opens the user's form

Sheet: TC8997, TC8991.

- **Given** the users list, searched for the user
- **When** I click **Edit** in the user's row
- **Then** `/users/edit/<id>` opens with the heading "Edit User"
- **And** the username field shows the username and is read-only
- **And** the user's name is filled in, the role is shown as text with **Edit Role**, and **Save** is shown

> **Differs from the sheet:** TC8991 says the admin updates the username. On the web the username can't be changed on Edit (read-only field). Only the role part of TC8991 is tested (UEDIT-05).

### UEDIT-02 Changed details are saved and shown

Sheet: TC8991, TC8997, TC9001, TC9439, TC9444.

- **When** I change Name, Email, Address and Employee Id and click **Save**
- **Then** the users list opens with "The user has been saved"
- **And** the user's details page shows the new Name, Email, Address and Employee ID
- **And** the Edit page, opened again, shows the new values

### UEDIT-03 An invalid email is refused

Sheet: TC9445.

- **When** I enter `not-an-email` as Email and click **Save**
- **Then** an Alert says "Enter valid Email id" and the Edit page stays open
- **When** I correct the email and click **Save**
- **Then** the users list shows "The user has been saved" and the details page shows the corrected email

### UEDIT-04 A blank name is refused

Sheet: TC9445.

- **When** I clear Name and click **Save**
- **Then** an Alert says "Name is a mandatory field" (as on Add User, UVAL-02) and the Edit page stays open

> **Known app bug (17 Nov 2026):** the user is saved with a blank name ("The user has been saved"); a name of only spaces is saved too. Expected failure until fixed.

### UEDIT-05 The role can be changed

Sheet: TC8991, TC9505, TC9506.

- **Given** a REPORT ADMIN user
- **When** I click **Edit Role**, pick ZONE MANAGER and click **Save** without picking a zone
- **Then** an Alert says "Please select Role details", the Edit page stays open, and no server error (5xx) occurs
- **When** I pick the zone "South" and click **Save** (answering OK if asked to continue without a reporting manager)
- **Then** the users list shows "The user has been saved"
- **And** the details page shows Role "ZONE MANAGER" and For "South"
- **And** the Edit page, opened again, shows the role ZONE MANAGER

### UEDIT-06 Reporting To of a distributor sales manager is kept

Sheet: TC9431.

- **Given** a DISTRIBUTOR SALES MANAGER user
- **When** I click **Edit Role**, pick "E2E SALES MANAGER" in **Select Reporting To** and click **Save**
- **Then** the users list shows "The user has been saved"
- **When** I open the Edit page again and click **Edit Role**
- **Then** Reporting To shows "E2E SALES MANAGER", not "Select User"
- **And** after saving without changes and opening it again, it still shows "E2E SALES MANAGER"

> The sheet repeats the check for a second distributor sales manager; one user is checked here.

## Out of scope

- Phone, Gmail ID, IMEI and date of birth on Edit (the same fields as Add User, UFORM).
- Designation: the dropdown is disabled on Edit (17 Nov 2026), also after Edit Role. Asked the team whether this is intended (`TODO.md`).
- Update Workflow, App Sequence, activity and generic forms, bill sequence numbers.
