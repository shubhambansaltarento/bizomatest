# Add user (one per role)

| Field       | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| Module      | Users                                                      |
| ID prefix   | `UADD`                                                     |
| Status      | Implemented (criteria awaiting team review)                |
| Tests       | `tests/users/add-user.spec.ts`                             |
| Roles       | **`data/userRoles.ts`** (role list and what each is mapped to) |
| Environment | `BASE_URL` from `.env` (dev: devarun)                      |

## Purpose

An admin creates a new user from Users → **New User**. The form only offers a role once the username has been checked and found free; each role then asks for what the user is mapped to (zone, warehouse, distributor, area). This spec checks that an admin can create a user of **every** role.

The roles and their mappings are kept in `data/userRoles.ts`, so adding a role means editing that file, not the tests.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- Each run **creates one new user per role** (13 on dev), named `e2e.<role>.<unique suffix>`, name "E2E <ROLE>", password from `newUserData` in `data/userRoles.ts`. At the end of each test the user is **deactivated** (the app has no delete), so only the Inactive list grows.
- The zones, warehouses, distributors and areas in `data/userRoles.ts` exist on the environment.

## Pages & URLs

| Page       | URL                    | Key elements |
| ---------- | ---------------------- | ------------ |
| Add User   | `/users/add`           | Username*, Password*, Name*, Phone, Email, … ; after a free username: **Role**, then the role's mapping dropdowns, Select Reporting To, **Add** |
| Users list | `/users/ajaxuserindex` | "User added successfully" after saving |

### How the form behaves (seen 10 Nov 2026)

- Leaving the Username field checks it (`POST /users/checkusername`): green "User name is Available" shows **Role** and **Add**; red "User name is not Available. Please Try Again with different Username." keeps them hidden. The check ignores case.
- Mapping per role:

| Role                                                          | Mapped to |
| ------------------------------------------------------------- | --------- |
| ADMIN, REPORT ADMIN, EXECUTION AUDITOR, INVENTORY MANAGER, VENDOR, ERP API User | nothing |
| ZONE MANAGER                                                  | ZONE |
| WAREHOUSE MANAGER, SALES MANAGER, DISTRIBUTOR MANAGER, DISTRIBUTOR SALES MANAGER | ZONE → Subzone → WAREHOUSE |
| SALESMAN                                                      | ZONE → Subzone → WAREHOUSE → AREA |
| DISTRIBUTOR SALESMAN                                          | ZONE → Subzone → DISTRIBUTOR → AREA |

- Roles with a hierarchy also show **Select Reporting To** (optional). Saving without it asks "Are you sure you want to continue without selecting a reporting manager in the user hierarchy?"; the tests answer OK.

## Acceptance criteria

### UADD-01 A username that is taken is refused

- **Given** I am on the Add User form
- **When** I enter an existing username (the logged-in admin's) and leave the field
- **Then** "User name is not Available. Please Try Again with different Username." is shown
- **And** the Role dropdown and the Add button stay hidden
- **And** the same happens for that username in upper case

### UADD-02 A free username unlocks the Role dropdown with every role

- **Given** I am on the Add User form
- **When** I enter a username nobody has and leave the field
- **Then** "User name is Available" is shown, with the Role dropdown and the Add button
- **And** the Role dropdown offers exactly the roles in `data/userRoles.ts`, in that order

### UADD-03 Admin can create a user of each role

Checked once **for every role** in `data/userRoles.ts`.

- **Given** I open the Add User form from the users list (**New User**)
- **When** I enter a free username, a valid password and a name, pick the role, fill its mapping, and click **Add**
- **Then** I am back on the users list with "User added successfully"
- **And** searching for the username finds exactly one user, with that name, Status "Active" and Role = the role

## Out of scope

- Validation messages: see `specs/users/add-user-validation.md`.
- Optional fields (phone, email, designation, reporting manager, images, date of birth).
- Logging in as the new user (see `TODO.md`).
