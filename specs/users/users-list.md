# Users list: controls, pagination and row actions

| Field       | Value                                          |
| ----------- | ---------------------------------------------- |
| Module      | Users                                          |
| ID prefix   | `ULIST`                                        |
| Status      | Implemented (criteria awaiting team review)    |
| Tests       | `tests/users/users-list.spec.ts`               |
| Environment | `BASE_URL` from `.env` (dev: devarun)          |

## Purpose

The users list is the admin's landing page and the entry point for managing users. Every control on it should work: the status filter, page size and paging, search, sorting, the row action buttons, Download and New User.

USR-01/02 (`specs/users/user-change-password.md`) already cover the default page size (25) and switching to 10; they are not repeated here.

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture.
- More than 10 active users exist (dev has 25 on 10 Nov 2026), so there is more than one page at 10 per page. Paging criteria are skipped, with a note, when there aren't.
- At least one inactive user exists (dev has 4).
- Nothing is changed: these tests only read.

## Pages & URLs

| Page              | URL                          | Key elements |
| ----------------- | ---------------------------- | ------------ |
| Users list        | `/users/ajaxuserindex`       | **New User**, **Download**, Active / Inactive / All Users filter, "Active Count : N", "Inactive Count : N", Show N entries, Search, table, First / Previous / page numbers / Next / Last |
| Edit user         | `/users/edit/<id>`           | Row action **Edit** |
| User location map | `/users/usermapview/<id>`    | Row action map-marker icon |
| PJP               | `/pjps/pjpupdate/<id>`       | Row action **Pjp** (opens in a new tab; not shown for every user) |
| Add user          | `/users/add`                 | **New User** |

## Acceptance criteria

### ULIST-01 The list shows its controls and columns

- **Given** I am on the users list
- **Then** the heading **Users**, **New User** and **Download** are shown
- **And** the status filter shows Active Users (selected), Inactive Users and All Users
- **And** "Active Count : N" and "Inactive Count : N" are shown
- **And** the columns are, in order: User ID, User Name, Name, Employee ID, Designation, Phone Number, Status, Role, For, ZONE, Actions

### ULIST-02 Status filter shows active, inactive or all users

- **Given** I am on the users list (Active Users selected)
- **Then** the total entries equal Active Count and every row's Status is "Active"
- **When** I choose Inactive Users
- **Then** the total equals Inactive Count and every row's Status is "Inactive"
- **When** I choose All Users
- **Then** the total equals Active Count + Inactive Count

### ULIST-03 Paging buttons move between pages

- **Given** the list shows 10 entries per page, with more than 10 active users
- **Then** on page 1, First and Previous are disabled and Next and Last are enabled
- **When** I click Next
- **Then** the summary reads "Showing 11 to …" and page 2 is current
- **When** I click Last
- **Then** the last entries are shown ("… to Z of Z entries") and Next and Last are disabled
- **When** I click Previous, then First
- **Then** I am back on page 1 ("Showing 1 to 10 of Z entries")
- **When** I click page number 2
- **Then** page 2 is shown

### ULIST-04 Search filters the rows

- **When** I search for the logged-in admin's username
- **Then** that user is among the rows, every row contains the search text, and the summary says "(filtered from Z total entries)"
- **When** I search for text no user has
- **Then** the table shows "No matching records found" and "Showing 0 to 0 of 0 entries"
- **When** I clear the search
- **Then** all Z entries are back

### ULIST-05 Sorting by User Name

- **Given** the list shows 100 entries per page (all active users on one page)
- **When** I click the **User Name** header
- **Then** it is sorted ascending
- **When** I click it again
- **Then** it is sorted descending, and the rows are the ascending order reversed

### ULIST-06 Row action buttons open the user's pages

- **Then** every row has **Edit** linking to `/users/edit/<row's User ID>` and a map marker linking to `/users/usermapview/<row's User ID>`; rows that have **Pjp** link it to `/pjps/pjpupdate/<row's User ID>`
- **When** I click a user's map marker
- **Then** `/users/usermapview/<id>` opens and I am still logged in
- **When** I click a user's **Pjp**
- **Then** `/pjps/pjpupdate/<id>` opens in a new tab
- **When** I click a user's **Edit**
- **Then** `/users/edit/<id>` opens showing that username

### ULIST-07 Download gives a CSV of users

- **When** I click **Download**
- **Then** a file named `User_List_<dd-mm-yyyy>.csv` (today's date) is downloaded and is not empty

### ULIST-08 New User opens the Add User form

- **When** I click **New User**
- **Then** I am on `/users/add` and the Username, Password and Name fields are shown

## Out of scope

- Column contents beyond Status and User Name; sorting by other columns.
- Expanding "…[ + ]" in the For column.
- Contents of the downloaded CSV beyond its name (see `TODO.md`).
- Editing, activating or deactivating users (see `TODO.md`, "Manage user").
