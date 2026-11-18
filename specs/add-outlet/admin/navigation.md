# Add outlet (admin): open Add / Edit Outlet by URL and from the menu

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Module      | Add outlet, section **Admin** (add and edit outlet)                   |
| ID prefix   | `AONAV`                                                               |
| Status      | Implemented (criteria awaiting team review)                           |
| Tests       | `tests/add-outlet/admin/navigation.spec.ts`                           |
| Test data   | Organisation path and outlet: `data/addOutlet.ts` → `admin`           |
| Source      | QA sheet `docs/Bizom QA Automation modules(AD-Add_Outlets).csv` (to be mapped) |
| Environment | `BASE_URL` from `.env` (dev: devarun), checked 18 Nov 2026            |

## Purpose

An admin reaches the Add Outlet and Edit Outlet pages in both ways the app offers: by typing the URL, and from the sidebar menu through **Dashboard → Organisation**. Every other admin outlet case starts from one of these pages.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture (see `specs/auth/login-logout.md`).
- Organisation path, area and outlet from `data/addOutlet.ts` (`admin`): South → Karnataka → Sri Ranga Distributors DISTRIBUTOR → area **SV Agencies** (id 1) → outlet **Venus Utility store** (id 3).
- These tests only open pages. They don't submit any form, so they create and change nothing.

## Pages & URLs

| Page | URL | Key elements |
| ---- | --- | ------------ |
| Organisation | `/companies/dashboard` (Sidebar → Dashboard → **Organisation**) | Tree: company → zone → subzone → warehouse / distributor → area. Each area row: area name link (loads its outlets on the right) and an action dropdown (**Add OUTLET**, Edit Area, Download OUTLET) with **Go** |
| Add Outlet | `/outlets/add` | Heading **Add OUTLET**; Name; **Zone**, **Warehouse/Distributor** and **Select Area** dropdowns; **Submit** |
| Add Outlet for an area | `/outlets/add/<areaId>` | Same form without the Zone / Warehouse / Area dropdowns (the area comes from the URL). Opened in a **new tab** by Organisation → area → Add OUTLET → Go |
| Outlet view | `/outlets/view/<id>` | Heading with the outlet name; pencil icon **Edit Outlet** (`/outlets/edit/<id>`). Opened in a **new tab** from the outlet list |
| Edit Outlet | `/outlets/edit/<id>` | Heading **OUTLET Details**; Name filled with the outlet's name |

## Acceptance criteria

### AONAV-01 Admin opens Add Outlet by URL

- **Given** I am logged in as ADMIN
- **When** I open `/outlets/add`
- **Then** the **Add OUTLET** form is shown, with the Name field and **Submit**
- **And** the **Zone**, **Warehouse/Distributor** and **Select Area** dropdowns are shown, and Zone lists at least one zone

### AONAV-02 Admin opens Add Outlet for an area by URL

- **Given** I am logged in as ADMIN
- **When** I open `/outlets/add/<areaId>` for the area in the test data
- **Then** the **Add OUTLET** form is shown, with the Name field and **Submit**
- **And** there are no Zone, Warehouse/Distributor or Area dropdowns

### AONAV-03 Admin opens Add Outlet from the menu

- **Given** I am logged in as ADMIN
- **When** I open Sidebar → **Dashboard** → **Organisation**
- **And** I expand the zone, subzone and warehouse of the test data
- **And** in the area's row I choose **Add OUTLET** and click **Go**
- **Then** a new tab opens on `/outlets/add/<areaId>` with the **Add OUTLET** form

### AONAV-04 Admin opens Edit Outlet by URL

- **Given** I am logged in as ADMIN
- **When** I open `/outlets/edit/<id>` for the outlet in the test data
- **Then** the Edit Outlet form (**OUTLET Details**) is shown, with Name filled with the outlet's name

### AONAV-05 Admin opens Edit Outlet from the menu

- **Given** I am logged in as ADMIN
- **When** I open Sidebar → **Dashboard** → **Organisation**, expand the zone, subzone and warehouse of the test data, and click the area's name
- **Then** the area's outlets are listed, including the test outlet
- **When** I click the outlet's name
- **Then** a new tab opens on `/outlets/view/<id>` showing the outlet's name
- **When** I click the pencil icon (**Edit Outlet**)
- **Then** `/outlets/edit/<id>` opens with Name filled with the outlet's name

## Out of scope

- Filling in and submitting the forms, validation, form definitions and URL permissions: the QA sheet cases, to be added to this section as their own specs.
- The **Unapproved Outlets** page and the global Search (Outlet), which are other ways to reach an outlet.
