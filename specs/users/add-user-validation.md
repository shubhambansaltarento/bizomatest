# Add user: validation

| Field       | Value                                          |
| ----------- | ---------------------------------------------- |
| Module      | Users                                          |
| ID prefix   | `UVAL`                                         |
| Status      | Implemented (criteria awaiting team review)    |
| Tests       | `tests/users/add-user-validation.spec.ts`      |
| Environment | `BASE_URL` from `.env` (dev: devarun)          |

## Purpose

The Add User form refuses incomplete or invalid input and says why. The username check on blur (taken / free) is covered by UADD-01/02; this spec covers what happens when **Add** is clicked.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- Each test uses a fresh, free username, and nothing is saved: every case is rejected before the form is sent.
- Unless a criterion says otherwise, the form is otherwise valid: password `newUserData.password`, name "E2E Validation", role REPORT ADMIN (a role with no mapping).

## How errors are shown

In an **Alert** dialog (title "Alert", button **Ok**), not next to the field. After closing it the form is still on `/users/add` with the values kept.

## Acceptance criteria

### UVAL-01 Username with illegal characters

- **When** the username contains characters other than letters, digits, `@`, `.` and `_` (e.g. a space or `#`)
- **Then** the Alert says "Username contains illegal characters."

> The blur check still says "User name is Available" for such a name; only Add rejects it.

### UVAL-02 Name is required

- **When** Name is empty, or only spaces
- **Then** the Alert says "Name is a mandatory field"

### UVAL-03 Password is required

- **When** Password is left empty (never typed in)
- **Then** the Alert says "Please add User Password"

> Typing a password and then deleting it gives "Please Enter a Valid password" instead, because the password rule runs on each key press.

### UVAL-04 Password must meet the rule

- **When** the password is too weak: too short (`abc`), or has no special character (`Web123123`)
- **Then** the Alert says "Please Enter a Valid password"

### UVAL-05 A role is required

- **When** no role is picked
- **Then** the Alert says "Please select a Role details."

### UVAL-06 The role's mapping is required

- **When** the role is ZONE MANAGER and no ZONE is picked
- **Or** the role is SALESMAN with ZONE, Subzone and WAREHOUSE picked but no AREA
- **Then** the Alert says "Please select a Role details."

### UVAL-07 A rejected form is not saved

- **Given** any of the cases above
- **Then** after closing the Alert I am still on `/users/add`, and the username has not been created (the users list search does not find it)

## Out of scope

- Phone, email, Gmail, IMEI and employee ID format checks (see `TODO.md`).
- Server-side validation (the browser checks run first, so the server is never reached in these cases).
