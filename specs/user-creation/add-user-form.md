# Add user: form fields

| Field       | Value                                                         |
| ----------- | ------------------------------------------------------------- |
| Module      | User creation                                                 |
| ID prefix   | `UFORM`                                                       |
| Status      | Implemented (criteria awaiting team review)                   |
| Tests       | `tests/user-creation/add-user-form.spec.ts`                   |
| Source      | QA sheet `docs/TestCases_11-11-26-07_45_22.csv` (case codes per criterion); index in `data/userCreationCases.ts` |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 16 Nov 2026    |

## Purpose

What the Add User form shows and accepts beyond the mandatory fields: a blank form, the username and password hints, the optional fields (phone, designation, date of birth), the order of the role mapping dropdowns, and that a new user can log in. Saving one user per role is in `add-user.md` (UADD); the Alerts for missing or invalid mandatory fields are in `add-user-validation.md` (UVAL).

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- Usernames are fresh automation names (`newUserData.username`). Only UFORM-04 and UFORM-14 save a user (role REPORT ADMIN, no mapping); it is deactivated at the end of the test.
- DISTRIBUTOR SALESMAN mapping values come from `data/userRoles.ts`.

## Pages & URLs

| Page      | URL           | Key elements |
| --------- | ------------- | ------------ |
| Add User  | `/users/add`  | Username, Password (rule list `#password_strength` under it), Name, Phone No. (+91 picker, "✓ Valid" / "Invalid number"), Email, Gmail ID, Address, IMEI, Designation, Employee Id, Date of Birth (read-only, calendar on click), Role (after the username check), **Add** |

## Acceptance criteria

### UFORM-01 New User opens a blank form

Sheet: TC8980, TC8998 (bug 130313).

- **When** I click **New User** on the users list
- **Then** `/users/add` opens with every field empty (username, password, name, phone, email, Gmail ID, address, IMEI, employee ID, date of birth), Designation on "Select Designation ...", and Role and **Add** not shown yet
- **And** after saving a user, the next New User form is blank again (checked in UFORM-04's test)

### UFORM-02 Username with letters, digits and @ . _ is available

Sheet: TC9004.

- **When** I enter a free username made of letters, digits and `@`, `.`, `_` (e.g. `e2e.user_1@x`)
- **Then** "User name is Available" is shown, with Role and **Add**

### UFORM-03 A blank username is refused

Sheet: TC8981.

- **Given** a free username was entered and checked, then the form filled in validly (name, password, role REPORT ADMIN)
- **When** I clear the username and click **Add**
- **Then** the Alert says "User Name cannot be left blank." and I stay on `/users/add` with my values

> **Known app bug (16 Nov 2026):** nothing in the browser stops it: the form is sent, the server answers with the red banner "Username already taken, please try with other name" on an emptied form. No user is created. The sheet's message only appears when another check fails at the same time (e.g. no role). Tested with `test.fail`.

### UFORM-04 A name another user already has is accepted

Sheet: TC9005 (its title says "password"; its steps and expected result are about Name).

- **When** I create a user whose Name is the same as an existing user's (the automation user "E2E REPORT ADMIN")
- **Then** no error is shown and the user is saved ("User added successfully")

### UFORM-05 The password rule list shows what is missing

Sheet: TC8984.

- **When** I type `Mobisy`
- **Then** red text under Password says "1 Digit Needed, 1 Special Character Needed,"
- **When** I type `mobisy`
- **Then** it says "1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,"
- **When** I clear the field
- **Then** it says "Minimum 6 Characters requires, 1 Lower Case Letter Needed, 1 Upper Case Letter Needed, 1 Digit Needed, 1 Special Character Needed,"
- **When** I type a valid password (`Mobisy@1`)
- **Then** the list is empty (shown in green)

### UFORM-06 An 8-digit phone number is invalid

Sheet: TC9006.

- **When** I enter `98765432` in Phone No. and leave the field
- **Then** red "Invalid number" is shown under it
- **And** clicking **Add** with an otherwise valid form gives the Alert "Enter valid phone number"

### UFORM-07 A 10-digit phone number is valid

Sheet: TC9007.

- **When** I enter `9876543210` and leave the field
- **Then** green "✓ Valid" is shown and no "Invalid number"

### UFORM-08 Designation can be picked, before and after picking a role

Sheet: TC9008.

- **Then** the Designation dropdown lists at least one designation (devarun: "DSM - DSM")
- **When** I pick one
- **Then** the dropdown shows it
- **And** after picking a role, the Designation dropdown still lists the same designations

### UFORM-09 Date of birth is picked from a calendar

Sheet: TC9009 (the sheet says dd-mm-yyyy; the app shows and saves YYYY-MM-DD).

- **Given** the Date of Birth field cannot be typed in (read-only)
- **When** I click it
- **Then** a calendar opens
- **When** I pick 15 May 1990
- **Then** the field shows `1990-05-15`

### UFORM-10 Date of birth cannot be in the future

Sheet: TC9010.

- **When** I open the calendar
- **Then** today is selectable, every later day of this month is disabled, and later months of this year are disabled in the month list
- **When** I click a disabled day
- **Then** the field stays empty

### UFORM-11 Role mapping dropdowns appear one after another

Sheet: TC9011, TC9012.

- **When** I pick the role DISTRIBUTOR SALESMAN
- **Then** "Select ZONE" appears, and Subzone does not yet
- **When** I pick a zone
- **Then** "Select Subzone" appears, and DISTRIBUTOR does not yet
- **When** I pick a subzone
- **Then** "Select DISTRIBUTOR" appears, and AREA does not yet
- **When** I pick a distributor
- **Then** "Select AREA" appears

### UFORM-12 Add is refused when the role's mapping cannot load

Sheet: TC9437 (titled "NA" in the sheet).

- **Given** the request that loads the role's mapping options fails (the test makes `/users/getidsforrole` answer 500)
- **When** I pick the role ZONE MANAGER, fill in the rest validly and click **Add**
- **Then** the Alert says "Please select a Role details.", I stay on `/users/add`, and no error page is shown

### UFORM-13 User custom fields keep their configured order

Sheet: TC9442, TC9443 (written for the Swastiks tenant).

- **Given** user custom fields are configured (Settings → Form Settings → User Form) in a known order
- **Then** Add User, the user's View page and Edit page show them in that order, also after the order is changed

> **Not testable on devarun yet:** it has no user custom fields (16 Nov 2026), and creating them changes the form for every user. Kept as `test.fixme` until a set of custom fields exists for testing.

### UFORM-14 A newly created user can log in on the web

Sheet: TC8995.

- **Given** the admin has just created a user (role REPORT ADMIN) with a password
- **When** that user logs in on the web, in another browser
- **Then** they are logged in and the banner says "you are REPORT ADMIN"

## Out of scope

- API cases of the sheet (TC9432, TC9440, TC9441, TC9522, TC9523) and the mobile app (TC8996).
- Email, Gmail, IMEI and employee ID validation (not in the sheet; see `TODO.md`).
- Attendance verification images: `config/user-images.md` (needs a setting).
