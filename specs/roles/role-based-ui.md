# Role-based UI

| Field       | Value                                          |
| ----------- | ---------------------------------------------- |
| Module      | Access control / navigation                    |
| ID prefix   | `ROLE`                                         |
| Status      | Implemented                                    |
| Tests       | `tests/roles/role-based-ui.spec.ts`            |
| Expected UI | **`data/roles.ts`** (one entry per role)       |
| Environment | `BASE_URL` from `.env` (dev: devarun)          |

## Purpose

Each user role sees only the navigation and options meant for it, and can't open other roles' pages by typing their URL. The expected UI of every role is kept in one config file, `data/roles.ts`. The tests compare the real screen against it, so adding a role or changing what a role should see means **editing the config, not the tests**.

## How to review this spec

The acceptance criteria below are the rules. **The actual expectations (which menus, which options, which blocked pages) are in `data/roles.ts`**, written to be readable without knowing TypeScript. Review that file together with this one. When the product changes what a role sees, update `data/roles.ts`.

## Preconditions & test data

| Role                | Account                                   | Notes |
| ------------------- | ----------------------------------------- | ----- |
| ADMIN               | `BIZOM_USERNAME` / `BIZOM_PASSWORD`        | |
| DISTRIBUTOR MANAGER | `DM_USERNAME` / `DM_NEW_PASSWORD`          | `pricing.distributor` / `Web@123123`. This password is set by the sales test (SALE-02); if someone changes it, these tests fail at login. (Switched from `pradeep.kumar` on 2 Nov 2026: someone else changed that account's password, so it is in use by a person.) |

## UI parts checked

| Part         | Where                                    | Notes |
| ------------ | ---------------------------------------- | ----- |
| Banner       | Top bar: "Welcome … you are **ROLE**"     | |
| Main Menu    | Left sidebar → **Main Menu**              | The top-level sections, e.g. Users, Dashboard, Inventory … |
| Section items| Each section's sub-items                  | Read from the menu the app renders for the role (opening each section on screen would load a page per section) |
| User menu    | `person` icon, top right                  | e.g. Settings, Billing, Change Password, Contact Support, Logout |
| Blocked pages| Pages of other roles, opened by URL       | The app sends the user to `/users/dashboard` (usually with a message such as "Invalid Access" or "Unauthorized access"; the wording varies, so it isn't checked) |

## Acceptance criteria

Each criterion is checked for **every role** in `data/roles.ts`.

### ROLE-01 The user lands in the app as the right role

- **Given** I log in with the role's account
- **Then** I land on the role's landing page (`/users/ajaxuserindex` for both current roles)
- **And** the banner reads "you are <ROLE>"

### ROLE-02 Main Menu shows exactly the role's sections

- **When** I open **Main Menu** in the sidebar
- **Then** the visible sections are exactly the role's sections, in the configured order: nothing missing and nothing extra

### ROLE-03 Each section has exactly the role's items

- **Then** every section contains exactly the role's sub-items, in the configured order

### ROLE-04 User menu shows exactly the role's options

- **When** I open the user menu (`person` icon)
- **Then** it shows exactly the role's options, in the configured order

### ROLE-05 Other roles' pages are blocked

- **When** I open, by URL, each page listed as blocked for the role
- **Then** I am sent to `/users/dashboard` instead of the page

> **Known issue (22 Oct 2026):** DISTRIBUTOR MANAGER can open `/targets/updatetargets` (Update User Targets, an ADMIN menu item) by URL. Four other ADMIN pages are blocked correctly. Raised for product confirmation. The test is marked as an *expected failure* (`test.fail`): the suite stays green while the issue exists, and the test reports **"unexpectedly passed"** once it is fixed, so we know to remove the marker.

## Out of scope

- Reports sub-menus (loaded only when Reports is opened; empty in the rendered menu).
- Page content and permissions inside a page (buttons per role, editable fields): to be added per module once the product is better understood.
- Visual appearance (layout, colours): see "Other ways to check UI" below.
- Roles other than ADMIN and DISTRIBUTOR MANAGER: no test accounts yet (framework proposal, Q1 and Q5).

## Other ways to check UI (for later)

- **ARIA snapshot** (`toMatchAriaSnapshot`): records the structure of a page region (headings, links, buttons) as text and compares it on each run. Good for "this panel should look like this".
- **Screenshot comparison** (`toHaveScreenshot`): pixel comparison. Catches visual changes, but breaks whenever data on screen changes, so only for stable screens.
