# Discovery: configuration, authentication and route navigation

| Field       | Value                                   |
| ----------- | --------------------------------------- |
| Module      | Discovery framework                     |
| ID prefix   | `DISC`                                  |
| Status      | Draft (23 Nov 2026): criteria from the configuration-driven discovery request, awaiting review and a first run against the app |
| Tests       | `tests/discovery/config-validation.spec.ts` (DISC-01..05, no browser), `tests/discovery/auth-navigation.spec.ts` (DISC-06..09, live app) |
| Environment | `BIZOM_BASE_URL` from `.env`; everything else from `config/discovery-config.json` |

## Purpose

The discovery framework opens Bizom's configuration pages read-only to record how the application is configured. Before any configuration is extracted, it must start only with valid configuration, log in safely, and reach each configured page. Nothing about the target (URL, credentials, routes, selectors, limits, output) is written in TypeScript.

## Preconditions & test data

- DISC-01..05 use made-up configuration in the test (base URL `https://bizom.example.test`, fake credentials). They open no browser.
- DISC-06..09 need `BIZOM_BASE_URL`, `BIZOM_USERNAME`, `BIZOM_PASSWORD` in `.env` (or `HEADLESS=false` to log in by hand) and the routes enabled in `config/discovery-config.json`.
- DISC-06..07 delete and recreate the saved session file (`authentication.session.storageStatePath`).
- Nothing in the application is changed: read-only mode blocks every POST, PUT, PATCH and DELETE, and logout and delete URLs.

## Pages & URLs

| Page | URL (from config) | Key elements |
| ---- | ----------------- | ------------ |
| Login | `authentication.loginRoute` (`/users/login`) | `authentication.selectors` |
| Session check | `authentication.session.validationRoute` (`/users/dashboard`) | `loggedInIndicator` |
| URL Permissions | `/urlpermissions/addpermissions` | Module dropdown `#modules` (45 modules); permissions appear only after choosing a module and then a filter (`#entities`): discovery module, not navigation |
| All Settings | `/settings/allsettings` | Rows load by `GET /settings/allsettings/1/1` after the page (~1300 rows) |
| Form Definitions | `/formdefinitions/` | DataTable `#formTable`, rows load by `POST /formdefinitions/index` (DataTables read, allowed in `readOnly.allowedRequests`) |
| Settings | `/settings` | 11 tabs; Features Settings loads by `GET /settings/configfeatures?partial=1`, the others on click |

## Acceptance criteria

### DISC-01 Missing or invalid environment values stop startup

- **Given** `BIZOM_BASE_URL` is missing or not an http(s) URL, or `HEADLESS` / `LOGIN_TIMEOUT` have invalid values
- **When** the configuration is loaded
- **Then** loading fails with an error naming each bad variable; with valid values, `HEADLESS` and `LOGIN_TIMEOUT` override the JSON and every route URL is `BIZOM_BASE_URL` + its path

### DISC-02 Missing credentials stop automated login only

- **Given** `BIZOM_USERNAME` or `BIZOM_PASSWORD` is missing
- **When** the configuration is loaded and a login method is chosen
- **Then** loading succeeds with a warning; with a visible browser the login falls back to manual; with a headless browser automated login stops with an error that says how to log in manually; and the configuration never prints the credentials

### DISC-03 Missing or invalid route configuration is an error

- **Given** `discovery.routes` is missing or empty, or a route has no `enabled` flag, a path that isn't a `/path`, an undeclared `discoveryType`, or a duplicate id; or the configuration file or login route is missing
- **When** the configuration is loaded
- **Then** loading fails with an error listing every problem

### DISC-04 Disabled routes do not execute

- **Given** a route with `"enabled": false`
- **When** a run is planned
- **Then** the route is skipped as `disabled` and never opened; with every route disabled, a run refuses to start

### DISC-05 Read-only mode cannot be switched off

- **Given** `readOnly.enabled` is not `true`, `readOnly.blockedMethods` lacks one of POST/PUT/PATCH/DELETE, or a route points at a blocked URL (e.g. `/users/logout`)
- **When** the configuration is loaded
- **Then** loading fails; and during a run, blocked URLs and blocked methods are aborted, except requests listed in `readOnly.allowedRequests` (path, and body when `bodyPattern` is set, must match)

### DISC-06 Login saves a reusable session

- **Given** no saved session
- **When** a discovery session starts
- **Then** it logs in (automated, or manual when configured), lands on a logged-in page, and saves the session to `storageStatePath` readable only by its owner

### DISC-07 A saved session is reused, an expired one is replaced

- **Given** a saved session
- **When** a discovery session starts
- **Then** it reuses the session without logging in; when the saved session no longer logs in (the app shows the login page) or is older than `maxAgeMinutes`, it is reported as expired, deleted, and replaced by a new login

### DISC-08 Every enabled route opens logged in, read-only

- **Given** a logged-in session
- **When** a navigation run starts
- **Then** exactly the enabled routes are opened, each at `BIZOM_BASE_URL` + its configured path; each shows the logged-in application with its data loaded (its `readySelector` reached, no loading indicator, no request blocked by read-only mode while it loaded) and no error text (the app's flash banner is recorded as an app message, not an error: it can carry a message left in the session by an earlier request); and a report, snapshots and screenshots are written to the configured output folders

### DISC-09 Credentials never appear in logs or output

- **Given** a login and a navigation run
- **When** the log lines, report and snapshots are read
- **Then** neither the username nor the password appears in any of them

## Out of scope

- Extracting configuration from the pages (discovery modules per `discoveryType`): next phase.
- Moving the existing e2e suite (page objects, `config/env.ts`) to `discovery-config.json`.
