# Users list: Designation column with attendance_audit (config)

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Module      | Users (config)                                                              |
| ID prefix   | `UDES`                                                                      |
| Status      | Implemented (criteria awaiting team review)                                 |
| Tests       | `tests/users/config/user-designation-column.spec.ts` (run: `npm run test:users:config`) |
| Settings    | `attendance_audit` (`data/settings.ts`), set for the test's own user        |
| Source      | QA sheet: TC10931, TC10932                                                  |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 17 Nov 2026                  |

## Purpose

The Designation column on the users list shows only the user's designation, whether `attendance_audit` is off or on.

## How it runs

- A config test (see `specs/config/login-settings.md`, "How config tests work"): the `appSettings` fixture sets `attendance_audit` **for one user only** and puts it back afterwards. It runs on its own: `npm run test:users:config`.
- The test creates its own REPORT ADMIN user with designation "DSM - DSM" (the only designation on devarun; it can be picked on Add User but not on Edit), then restores the setting and deactivates the user at the end, pass or fail.

## Pages & URLs

| Page       | URL                    | Key elements |
| ---------- | ---------------------- | ------------ |
| Users list | `/users/ajaxuserindex` | Search, Designation column |

## Acceptance criteria

### UDES-01 With attendance_audit off, Designation shows only the designation

Sheet: TC10931.

- **Given** `attendance_audit` is 0 for the user
- **When** I search the users list for the user
- **Then** the user's Designation cell is exactly "DSM"

### UDES-02 With attendance_audit on, Designation still shows only the designation

Sheet: TC10932.

- **Given** `attendance_audit` is 1 for the user
- **When** I search the users list for the user
- **Then** the user's Designation cell is exactly "DSM"

## Out of scope

- What attendance audit itself does (attendance screens).
