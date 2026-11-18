# Add outlet (distributor manager): open Add / Edit Outlet by URL and from the menu

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Module      | Add outlet, section **Distributor manager** (add and edit outlet)     |
| ID prefix   | `DONAV`                                                               |
| Status      | Implemented (criteria awaiting team review)                           |
| Tests       | `tests/add-outlet/dm/navigation.spec.ts`                              |
| Test data   | Organisation path and outlet: `data/addOutlet.ts` → `distributorManager` |
| Source      | QA sheet: to be added                                                 |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 18 Nov 2026            |

## Purpose

A distributor manager (DM) reaches the Add Outlet and Edit Outlet pages in both ways the app offers: by typing the URL, and from the sidebar menu through **Dashboard → Organisation**. Every other DM outlet case starts from one of these pages.

## Preconditions & test data

- Logged in as DISTRIBUTOR MANAGER via the `authedPage` fixture with `test.use({ role: 'distributorManager' })`: account `DM_USERNAME` / `DM_NEW_PASSWORD` from `.env` (`pricing.distributor` on devarun).
- Organisation path, area and outlet from `data/addOutlet.ts` (`distributorManager`), which must belong to that account: Pricing Zone → Pricing_Sub_Zone → Pricing Warehouse 1 → area **Pricing Area 1** (id 4) → outlet **Pricing_Outlet_1** (id 222).
- These tests only open pages. They don't submit any form, so they create and change nothing.

## Pages & URLs

Same pages as the admin section (`specs/add-outlet/admin/navigation.md`), with these differences seen on 18 Nov 2026:

| Page | URL | What differs for the DM |
| ---- | --- | ----------------------- |
| Organisation | `/companies/dashboard` | Shows only the DM's own zones (Pricing Zone → Pricing_Sub_Zone); only **Add Distributor** at the top (no Add Zone / Edit Company) |
| Add Outlet | `/outlets/add` | No Zone or Warehouse/Distributor dropdowns; **Select Area** lists the DM's areas |
| Outlet view | `/outlets/view/<id>` | No pencil icon (**Edit Outlet**) |
| Edit Outlet | `/outlets/edit/<id>` | Refused: back on `/outlets/view/<id>` with "You do not have sufficient permission to edit an OUTLET." |

## Acceptance criteria

### DONAV-01 DM opens Add Outlet by URL

- **Given** I am logged in as DISTRIBUTOR MANAGER
- **When** I open `/outlets/add`
- **Then** the **Add OUTLET** form is shown, with the Name field and **Submit**
- **And** the **Select Area** dropdown lists the test data's area
- **And** there are no Zone or Warehouse/Distributor dropdowns

### DONAV-02 DM opens Add Outlet for an area by URL

- **Given** I am logged in as DISTRIBUTOR MANAGER
- **When** I open `/outlets/add/<areaId>` for the area in the test data
- **Then** the **Add OUTLET** form is shown, with the Name field and **Submit**

### DONAV-03 DM opens Add Outlet from the menu

- **Given** I am logged in as DISTRIBUTOR MANAGER
- **When** I open Sidebar → **Dashboard** → **Organisation**
- **And** I expand the zone, subzone and warehouse of the test data
- **And** in the area's row I choose **Add OUTLET** and click **Go**
- **Then** a new tab opens on `/outlets/add/<areaId>` with the **Add OUTLET** form

### DONAV-04 DM opens Edit Outlet by URL

- **Given** I am logged in as DISTRIBUTOR MANAGER
- **When** I open `/outlets/edit/<id>` for the outlet in the test data
- **Then** the Edit Outlet form (**OUTLET Details**) is shown, with Name filled with the outlet's name

> **Open question (18 Nov 2026):** on devarun the DM is refused: the app goes back to `/outlets/view/<id>` with "You do not have sufficient permission to edit an OUTLET." Likely the DM's URL permission (`/urlpermissions/addpermissions`) for outlet edit is off. Tested as an *expected failure* (`editKnownIssue` in `data/addOutlet.ts`) until it is confirmed whether a DM should be able to edit outlets.

### DONAV-05 DM opens Edit Outlet from the menu

- **Given** I am logged in as DISTRIBUTOR MANAGER
- **When** I open Sidebar → **Dashboard** → **Organisation**, expand the zone, subzone and warehouse of the test data, and click the area's name
- **Then** the area's outlets are listed, including the test outlet
- **When** I click the outlet's name
- **Then** a new tab opens on `/outlets/view/<id>` showing the outlet's name
- **When** I click the pencil icon (**Edit Outlet**)
- **Then** `/outlets/edit/<id>` opens with Name filled with the outlet's name

> **Open question (18 Nov 2026):** the outlet view has no pencil icon for the DM (same cause as DONAV-04). Expected failure until confirmed.

## Out of scope

- Filling in and submitting the forms, validation, and URL permissions: the QA sheet cases, to be added to this section as their own specs.
- Checking that the DM sees only their own zones and areas (could be added as a criterion).
