# User details page

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Module      | Users                                                        |
| ID prefix   | `UVIEW`                                                      |
| Status      | Implemented (criteria awaiting team review)                  |
| Tests       | `tests/users/user-details.spec.ts`                           |
| Source      | QA sheet `docs/TestCases_11-11-26-07_45_22.csv` (case codes per criterion) |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 17 Nov 2026   |

## Purpose

An admin opens a user's details page from the users list. It loads without server errors, also on reload and from its Home link, and shows when the user last logged in and out.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- UVIEW-01/02 only read the pages of the fixed automation users E2E REPORT ADMIN and E2E SALES MANAGER (`data/automationUsers.ts`).
- UVIEW-03/04 create their own REPORT ADMIN user (`createTestUser`), log in and out as that user in a separate browser (`loginAs`), and deactivate the user at the end.

## Pages & URLs

| Page         | URL                    | Key elements |
| ------------ | ---------------------- | ------------ |
| Users list   | `/users/ajaxuserindex` | Search, username links |
| User details | `/users/view/<id>`     | **Edit**; table: Username, Name, Employee ID, …, Role, For, Hierarchy, Login Details ("Last Login Date Time : …"), Logout Details ("Last Logout Time : …"); side menu **Home** (`/users/details/<id>`, which shows `/users/view/<id>` again), Attendance, Order Report, … |

## Acceptance criteria

### UVIEW-01 Clicking a username opens the user's details

Sheet: TC9013.

- **Given** the users list, searched for the user
- **When** I click the username
- **Then** `/users/view/<id>` opens with **Edit**
- **And** the table shows the user's Username, Name and Role

### UVIEW-02 The details page loads without server errors

Sheet: TC9516, TC9521.

- **For** two users (E2E REPORT ADMIN and E2E SALES MANAGER)
- **When** I open `/users/view/<id>`, reload it twice, and click **Home**
- **Then** the page shows the user's Username each time, Home shows the details page again (`/users/view/<id>`), and no server error (5xx) occurs

### UVIEW-03 Last login time is updated after a web login

Sheet: TC10592.

- **When** the user logs in on the web, and the admin then opens the user's details page
- **Then** Login Details reads "Last Login Date Time : <today's date> <time>"
- **And** no "Last Login Version" is shown

> **Known issue on devarun (17 Nov 2026):** Login and Logout Details are no longer updated: they are empty for users who logged in today, and the main admin's still show 2026-08-28. The sheet's precondition says "Custom branch should be available", so the feature may be missing from devarun's build. Expected failure until confirmed.

### UVIEW-04 Last logout time is updated after a web logout

Sheet: TC10593.

- **When** the user then logs out on the web, and the admin opens the details page again
- **Then** Logout Details reads "Last Logout Time : <today's date> <time>" (not "N/A"), and Login Details still shows today

> Same known issue as UVIEW-03. Expected failure.

## Out of scope

- The side menu's other pages (Attendance, Order Report, Activities Report, …).
- Mobile app logins and logouts.
