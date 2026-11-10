# Distributor manager: reset password → direct sale

| Field       | Value                                      |
| ----------- | ------------------------------------------ |
| Module      | Sales                                      |
| ID prefix   | `SALE`                                     |
| Status      | Implemented                                |
| Tests       | `tests/sales/dm-direct-sale.spec.ts`       |
| Environment | `BASE_URL` from `.env` (dev: devarun)      |

## Purpose

An admin resets a distributor manager's password. That distributor manager then logs in with the new password and records a direct sale to a buyer, ordering 1 case of every listed item, and the sale is created.

## Preconditions & test data

- Starts logged in as the admin via the `authedPage` fixture (AUTH-01). The fixture's logout (AUTH-02) at the end logs out whoever is logged in then, i.e. the distributor manager.
- New password: `DM_NEW_PASSWORD` from `.env` (`Web@123123`).
- The distributor manager is picked **at random** from users whose Role is `DISTRIBUTOR MANAGER` **and** who are mapped to at least one distributor (the "For" column is not empty). Unmapped managers (currently Rabbi.DM, Shegal.DM) can't sell and are skipped.
- The picked username is stored for the rest of the test and recorded in the report, together with the warehouse, buyer, and the invoice ID of the created sale.
- **Side effects (dev data):** each run sets the picked user's password to `Web@123123`, creates one sale, and reduces stock by 1 case per item sold.
- **Shared accounts are in use by people.** On 2 Nov 2026, `pradeep.kumar`'s password had been changed by someone else, so this test resetting it to `Web@123123` can lock that person out. Dedicated test accounts are needed (framework proposal, Q5).

## Pages & URLs

| Page                     | URL                     | Key elements                                                                                       |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Users list               | `/users/ajaxuserindex`  | Role and "For" (mapped distributors) columns, **Edit**                                              |
| Edit user                | `/users/edit/<id>`      | **Change Password** → "Password Change" dialog (New / Confirm Password) → "Successfully changed password" alert |
| Sale wizard              | `/payments/sale`        | Wizard links **Previous / Next / Finish**                                                           |
| ↳ Warehouse prompt       | dialog on load          | "Please select depo first" + **Select Warehouse**. Shown only to managers mapped to several warehouses |
| ↳ Step 1: Account Details|                         | Filter Buyer (**All OUTLETs**, AREAs, BEATs, …), **Select Buyer**, BRAND, order table (one row per item: Available Case / SUBCASE / Unit, and Case / SUBCASE / Unit inputs) |
| ↳ Step 2: Added SKUs     |                         | Items added to the order, with quantities and amounts                                              |
| ↳ Step 3: Summary        |                         | Payment Mode, OUTLET information, item summary; **Finish** enabled                                  |

## Acceptance criteria

### SALE-01 Admin picks a random distributor manager

- **Given** I am logged in as the admin, on the users list
- **When** I show all users and pick a random user with Role `DISTRIBUTOR MANAGER` who is mapped to a distributor
- **And** I click that user's **Edit**
- **Then** the Edit page of that user opens (Username field shows the picked username)

### SALE-02 Admin changes the distributor manager's password

- **Given** I am on the picked user's Edit page
- **When** I click **Change Password**, enter `DM_NEW_PASSWORD` in New Password and Confirm Password, and click **Change Password** in the dialog
- **Then** the alert "Successfully changed password" is shown

### SALE-03 Distributor manager logs in with the new password

- **Given** the password was changed
- **When** the admin logs out, and I log in with the stored username and `DM_NEW_PASSWORD`
- **Then** I am logged in, and the banner reads "you are DISTRIBUTOR MANAGER"

### SALE-04 Step 1: buyer selected and items listed

- **Given** I am logged in as the distributor manager
- **When** I open `/payments/sale`
- **And** if asked to select a warehouse, I choose the first warehouse that has buyers and stock of at least 1 case for every item
- **And** I choose **All OUTLETs** and select a random buyer
- **Then** the order table lists at least one item

### SALE-05 Step 2: every item is added with 1 case

- **Given** the order table lists the buyer's items
- **When** I enter 1 in the Case column of every row and click **Next**
- **Then** Step 2 "Added SKUs" lists every item with Case 1

### SALE-06 Step 3: summary is shown

- **When** I click **Next**
- **Then** Step 3 "Summary" is shown with the selected buyer, and **Finish** is enabled
- **And** Payment Mode is set to **Cash**: it is selected if empty, because its default depends on the buyer and is sometimes blank

### SALE-07 Finish creates the sale

- **When** I click **Finish**
- **Then** the server confirms the sale (`Result: true`) and returns an invoice ID
- **And** the wizard resets to Step 1 for a new sale

> **Open defect (2 Nov 2026):** Finish fails on dev with `Result: false` and a database error: `Unknown column 'reference_child_outlet_id'` when inserting into `cdnotes` (seen with pricing.distributor, Pricing Warehouse 2, buyer 222). Looks like a database migration missing on devarun; reported to the dev team. SALE-07 is expected to fail until it is fixed.

## Out of scope

- Payment modes other than the default (Cash), discounts, schemes, other payment details.
- SUBCASE / Unit quantities; brands other than the default one.
- Verifying the sale in reports or the invoice list (this direct sale does not appear in **Today → List Orders**).
- Restoring the user's previous password (it is unknown to the test).

## Risks

- **Stock runs out.** Every run consumes 1 case per item. The smallest stock is "Pricing Warehouse 2 → Hamam 100" with about 14 cases (19 Oct 2026). Two of the three managers sell from it. When no warehouse has stock for every item, SALE-04 fails with a clear message, and stock must be topped up.
