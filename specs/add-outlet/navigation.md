# Add Outlet: navigation from Organisation

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| Module      | Add Outlet                                             |
| ID prefix   | `ONAV`                                                 |
| Status      | Draft (criteria awaiting review; no tests yet)         |
| Tests       | `tests/add-outlet/navigation.spec.ts`                  |
| Environment | `BASE_URL` from `.env` (dev: devarun)                  |

## Purpose

An admin adds an outlet to an area. There is no **Add Outlet** item in the sidebar: the page is reached from **Dashboard → Organisation**, by opening the area in the zone tree and choosing **Add OUTLET → Go**. This spec checks that this path works and opens the Add Outlet page for the chosen area. Filling in and saving the form is a separate spec.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture (see `specs/auth/login-logout.md`).
- An active area in the Organisation tree. On dev (recorded 19 Nov 2026):

  | Level                 | Value                  | Id   |
  | --------------------- | ---------------------- | ---- |
  | Zone                  | South                  |      |
  | Sub-zone              | Tamilnadu              |      |
  | Distributor           | Rockstar DISTRIBUTOR   | 29   |
  | Area                  | Acharapakkam (Active)  | 20   |
  | Area's location       | TAMIL NADU / KANCHEEPURAM / Kanchepuram City | |

  These belong in a data file (for example `data/outlets.ts`), not in the tests.
- Nothing is created or changed: the flow stops on the Add Outlet page without submitting.

## Pages & URLs

| Page          | URL                       | Key elements |
| ------------- | ------------------------- | ------------ |
| Organisation  | `/companies/dashboard`    | Sidebar section **Dashboard** with **Organisation** active; company accordion (**arun**) with zones; hint "Please Click on Area to load Outlet." |
| Zone tree     | same page (loaded by AJAX) | Zone → sub-zone → warehouse / distributor → table of areas. Each area row: area name ("Acharapakkam( Active )"), an action dropdown (`#areaselect<areaId>`) and a **Go** button |
| Add Outlet    | `/outlets/add/<areaId>`   | Heading **Add OUTLET**; sections **OUTLET Details**, **Tax Details**, **Owner Details**, **Outlet Contact Persons**; buttons **Check Duplicates** and **Submit** |

## Acceptance criteria

### ONAV-01 Organisation shows each area with an "Add OUTLET" action

- **Given** I am logged in as ADMIN
- **When** I open **Main Menu → Dashboard → Organisation**
- **Then** I am on `/companies/dashboard`, the sidebar shows the **Dashboard** section, and the hint "Please Click on Area to load Outlet." is shown
- **When** I expand zone **South**, then sub-zone **Tamilnadu**, then **Rockstar DISTRIBUTOR**
- **Then** the area **Acharapakkam( Active )** is listed with an action dropdown and a **Go** button
- **And** the dropdown offers exactly **Add OUTLET**, **Edit Area**, **Download OUTLET**, in that order, with **Add OUTLET** selected by default

### ONAV-02 "Add OUTLET → Go" opens the Add Outlet page for that area in a new tab

- **Given** the area row from ONAV-01 is shown
- **When** I choose **Add OUTLET** and click **Go**
- **Then** a new browser tab opens on `/outlets/add/20` (the area's id)
- **And** the original tab stays on `/companies/dashboard`

### ONAV-03 The Add Outlet page loads correctly

- **Given** the Add Outlet tab from ONAV-02
- **Then** I am still logged in there as ADMIN (banner "Welcome you are ADMIN", user icon), not sent to the login page
- **And** the heading **Add OUTLET** and the sections **OUTLET Details**, **Tax Details**, **Owner Details** and **Outlet Contact Persons** are shown
- **And** the **Name**, **Phone No.** and **Select Beat** fields and the **Check Duplicates** and **Submit** buttons are shown
- **And** no dialog is open (the page's "Please choose Outlet Type", "DUPLICATE OUTLET LIST" and validation dialogs stay closed until used)
- **And** the page shows no error text (same list as ADM-02) and raises no JavaScript errors

### ONAV-04 The chosen area's location is filled in

- **Given** the Add Outlet tab from ONAV-02 (area Acharapakkam)
- **Then** **State** shows **TAMIL NADU**, **District** shows **KANCHEEPURAM** and **City** shows **Kanchepuram City** (the area's location)
- **And** **Village** shows "Please select Village" and **Select Beat** shows "Please select"
- **And** no area picker is shown: the area is carried with the form (hidden field `data[Outlet][area_id]` = `20`)

### ONAV-05 Opening Add Outlet by URL without an area

- **Given** I am logged in as ADMIN
- **When** I open `/outlets/add` directly (no area id)
- **Then** the Add Outlet page loads (heading **Add OUTLET**, no error text)
- **And** **State** shows "Please select a State", and **District** / **City** are not shown
- **And** an area field (`data[Outlet][area_id]`) is shown and empty

> **For review:** the app supports this URL, but no screen links to it. Should it be a supported way in (keep ONAV-05), or should the app refuse it and require an area (then ONAV-05 changes)? Please confirm before tests are written.

## Notes from the recording (19 Nov 2026)

- **Not in the sidebar:** the admin sidebar (`data/roles.ts` → `admin.sidebar`) has no Add Outlet item. On the Add Outlet page the sidebar shows **Main Menu** sections collapsed, with no section heading, because the URL isn't a menu item (as for `/schemes/addscheme` in ADM-02).
- **New tab:** **Go** calls `window.open('/outlets/add/<areaId>')`, so tests must wait for the new page (`context.waitForEvent('page')`) instead of checking the current tab.
- **Clicking the area name** loads that area's outlets on the right ("Acharapakkam, Rockstar", "Total OUTLET - 9", outlets table). That panel has no Add Outlet button; it's covered by neither criterion.
- **Other unapproved-outlet banner:** Organisation shows "Your Organization has 4 unapproved Outlet. To view Click Here." The count depends on the data, so it isn't asserted.
- Recording files (git-ignored): `.playwright-mcp/add-outlet-navigation/` holds screenshots `01`–`07`, `trace.zip` (`npx playwright show-trace .playwright-mcp/add-outlet-navigation/trace.zip`), a video and `flow-log.txt`.

## Out of scope

- Filling in, validating and submitting the form (Name / Phone required, duplicate check, outlet type dialog, KYC dialogs): a separate spec, e.g. `specs/add-outlet/add-outlet-form.md`.
- The other area actions (**Edit Area**, **Download OUTLET**) and the zone / warehouse buttons (Add Zone, Add Distributor, Add AREA, …).
- Adding outlets from other places (unapproved outlets approval, mobile app, bulk upload) and other roles' access to `/outlets/add`.
