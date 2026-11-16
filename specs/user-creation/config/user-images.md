# User attendance verification images (config)

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Module      | User creation (config)                                                      |
| ID prefix   | `UIMG`                                                                      |
| Status      | Implemented (criteria awaiting team review)                                 |
| Tests       | `tests/user-creation/config/user-images.spec.ts` (run: `npm run test:user-creation:config`) |
| Settings    | `attendanceFaceVerification` (`data/settings.ts`), set for the test's own user |
| Source      | QA sheet: TC9524, TC9531, TC9532, TC9537 (written for a Laravel dev build)  |
| Environment | `BASE_URL` from `.env` (dev: devarun)                                       |

## Purpose

When `attendanceFaceVerification` is on for a user, the admin uploads 3 to 5 profile images on the user's Edit page; the app compares them with the photo taken when the user marks attendance.

## How it runs

- A config test (see `specs/config/login-settings.md`, "How config tests work"): the `appSettings` fixture switches the setting on **for one user only** and puts it back afterwards. It runs on its own: `npm run test:user-creation:config`.
- The test creates its own automation user (`e2e.reportadmin.<suffix>`, role REPORT ADMIN), then restores the setting and deactivates the user at the end, pass or fail.
- Images: `data/images/user-image-1.png` … `-5.png` (small PNGs). Uploads are stored by the app (bucket folder `userprofilepic`).

## Pages & URLs

| Page       | URL                | Key elements |
| ---------- | ------------------ | ------------ |
| Edit user  | `/users/edit/<id>` | "User Attendance Verification Images": file input `#imageUploadInput`, uploaded images, limit message `#imageLimitMessage`; **Save** |

## Acceptance criteria

### UIMG-01 The images field is shown when the setting is on for the user

- **Given** `attendanceFaceVerification` = 1 for the user
- **When** the admin opens the user's Edit page
- **Then** the attendance verification images field is shown, with no images yet

### UIMG-02 Fewer than 3 images are refused

- **When** the admin saves with fewer than 3 images
- **Then** the Alert says "A minimum of 3 user images are mandatory." and the page stays on Edit

### UIMG-03 Three images are saved without a server error

Sheet: TC9524, TC9531, TC9537.

- **When** the admin uploads 3 images and saves
- **Then** the users list says "The user has been saved", no request answers with a 5xx status
- **And** reopening the Edit page shows the 3 images

### UIMG-04 No more than 5 images

Sheet: TC9532.

- **Given** the user has 5 images
- **When** the admin tries to add a 6th
- **Then** it is not added, the file input is gone, and "You have uploaded 5 images. No more uploads allowed." is shown
- **And** after saving and reopening the Edit page with 5 images, the file input is gone (disabled) and the message is shown in red

### UIMG-05 Right after the 5th image, no more can be added

Sheet: TC9532 ("after uploading 5 images, the option to select a 6th image is disabled").

- **When** the admin uploads the 5th image
- **Then** the file input is gone (disabled) and the message is shown, without trying a 6th

> **Known app bug (16 Nov 2026):** the page checks the limit before the uploads finish, so right after the 5th image the file input is still offered and no message shows; it only appears when a 6th is tried, or after reopening. Tested with `test.fail`.

## Out of scope

- The attendance photo match itself (mobile app).
- Turning the setting on for a role or designation (affects every user with it).
