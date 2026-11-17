# User block: progressive lockout after wrong passwords

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Module      | User block (sub-module of Users)                                            |
| ID prefix   | `UBLK`                                                                      |
| Status      | Implemented (criteria awaiting team review)                                 |
| Tests       | `tests/user-block/progressive-lockout.spec.ts` (run: `npm run test:user-block`) |
| Settings    | `Progressivelockout` (`data/settings.ts`), **company-wide**                 |
| Config      | `USER_BLOCK_ATTEMPTS` in `.env`: wrong passwords to try, 2 to 9 (default 9); messages in `data/userBlock.ts` |
| Source      | QA sheet: TC10597–TC10605, TC10607, TC10610                                 |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 17 Nov 2026                  |

## Purpose

With `Progressivelockout` on, wrong passwords first give the usual error, then block the user for longer and longer; while blocked, even the right password is refused, and once the block has run out the user can log in again.

## How it runs

- **On its own only:** `npm run test:user-block` (own Playwright project, enabled by `E2E_USER_BLOCK`). Never with the normal suite or the config tests: the setting is company-wide, so while it is on, every wrong password on devarun counts, including AUTH-03's wrong password for the shared admin.
- The `appSettings` fixture sets `Progressivelockout` to 1 and puts the original value back at the end, pass or fail.
- The test creates its own REPORT ADMIN user (`createTestUser`), tries the configured number of wrong passwords, and deactivates the user at the end.
- **Time:** about N + 3 minutes for N wrong passwords (the run waits N minutes for the block to end). N = 9 covers every criterion; N = 2 runs in a few minutes but checks no block.

## Pages & URLs

| Page  | URL            | Key elements |
| ----- | -------------- | ------------ |
| Login | `/users/login` | Error message under the form |

## Acceptance criteria

N is `USER_BLOCK_ATTEMPTS` (2 to 9).

### UBLK-01 The first two wrong passwords give the usual error

Sheet: TC10597, TC10598.

- **Given** `Progressivelockout` is 1
- **When** the user logs in with a wrong password the 1st and 2nd time
- **Then** they stay on the login page with "Invalid User credentials.."

### UBLK-02 From the 3rd wrong password on, the n-th blocks for n minutes

Sheet: TC10599–TC10605 (3rd to 9th; each run checks up to the N-th).

- **When** the user logs in with a wrong password the n-th time (3 ≤ n ≤ N), straight after the previous one
- **Then** they stay on the login page with "Your account has been blocked for next n minutes."

> **Differs from the sheet:** the sheet expects "Invalid User Credentials.." up to the 4th try and the first block at the 5th ("blocked for next 5 minutes"). devarun blocks from the 3rd. Also, wrong passwords tried while blocked still count (no need to wait between tries).

### UBLK-03 While blocked, the right password is refused

Sheet: TC10610 (web part). Only when N ≥ 3.

- **When** the user logs in with the right password straight after the N-th wrong one
- **Then** they stay on the login page with "Your account has been blocked It will be unlocked after N minutes"

### UBLK-04 After the block has run out, the right password logs in

Sheet: TC10607 (web part).

- **When** N minutes have passed since the N-th wrong password (no wait when N < 3) and the user logs in with the right password
- **Then** they are logged in

## Out of scope

- The 10th wrong password (blocked until unblocked, TC10606) and the admin's **Unblock** (TC10595, setting `unblockuser`): the test stops at 9 so the user is never blocked for good.
- The mobile app part of TC10607 / TC10610, and TC10609 (all transactions with the setting off).
