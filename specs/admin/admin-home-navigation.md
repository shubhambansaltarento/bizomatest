# Admin: landing page and sidebar navigation

| Field       | Value                                                    |
| ----------- | -------------------------------------------------------- |
| Module      | Admin                                                    |
| ID prefix   | `ADM`                                                    |
| Status      | Implemented (criteria awaiting team review)              |
| Tests       | `tests/admin/admin-home-navigation.spec.ts`              |
| Expected UI | Sidebar sections and items: `data/roles.ts` → `admin`     |
| Environment | `BASE_URL` from `.env` (dev: devarun)                    |

## Purpose

After logging in, an admin lands on the users list and can reach every page in the sidebar. This checks that the redirect after login is right and that no sidebar link is broken (wrong page, error page, or bounced to login / dashboard).

## Preconditions & test data

- Logged in as ADMIN via the `authedPage` fixture (see `specs/auth/login-logout.md`).
- The sidebar items to open are taken from `data/roles.ts` (`admin.sidebar`); ROLE-02/03 already check that this list matches the app.

## Pages & URLs

| Page          | URL                    | Key elements |
| ------------- | ---------------------- | ------------ |
| Users list    | `/users/ajaxuserindex` | Heading **Users**, users table, "Showing X to Y of Z entries" |
| Sidebar       | every page             | **Main Menu** (sections), the current section's items under a heading with the section name |

## Acceptance criteria

### ADM-01 Admin lands on the users list after login

- **Given** I log in as ADMIN
- **Then** I am on `/users/ajaxuserindex`
- **And** the banner reads "you are ADMIN"
- **And** the heading **Users** and the users table are shown, with the table loaded ("Showing X to Y of Z entries", Z ≥ 1)
- **And** the sidebar shows the **Dashboard** section, with **Users** among its items

### ADM-02 Every sidebar item opens its page

- **Given** I am logged in as ADMIN
- **When** for each section with items, I open **Main Menu**, click the section, then click each of its items
- **Then** each click lands on the item's own URL (the link's target)
- **And** I am still logged in (banner and user icon visible), not sent to the login page
- **And** the page shows no error text ("Missing Controller", "Missing Method", "Fatal error", "Internal Server Error", "Page Not Found", "Invalid Access", "Unauthorized access")
- **And** the sidebar still shows that section

One test per section, so a broken page names its section.

> **Redirect:** Discounts → **New Scheme** links to `/schemes/add`, which redirects to `/schemes/addscheme` (the Add Scheme page). That is the expected landing (`sidebarRedirects` in `data/roles.ts`). On that page the sidebar shows no section (the URL isn't in the menu), so the "sidebar still shows that section" check is skipped for it. Raised for the product team: the link could point straight to `/schemes/addscheme`.
>
> **Known issue (10 Nov 2026):** Dashboard → **Set Outlet Targets** (`/outlettargets/settarget`) loads without jQuery ("jQuery is not defined"): no navbar, no sidebar, no styles, only the heading "Set Outlet Target". Kept as an *expected failure* (`sidebarKnownIssues` in `data/roles.ts`); the test reports "unexpectedly passed" once fixed.

## Out of scope

- **Reports**: its items are loaded only when it is opened, and it has no page of its own. To be added (see `TODO.md`).
- What each page contains beyond the checks above.
- Other roles' navigation (ROLE-02/03 check their menus; opening every item could reuse ADM-02 later).
