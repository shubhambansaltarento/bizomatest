# Specs

Every flow we automate starts here, as a Markdown spec. Tests are written from the spec, not the other way round.

## Workflow

1. **Write the spec.** Copy `_template.md` to `specs/<module>/<flow>.md`. Fill in the purpose, test data, pages, and acceptance criteria as Given / When / Then. Give each criterion an ID: `<PREFIX>-NN` (for example `AUTH-01`, `ORD-03`). Set Status to `Draft`.
2. **Review the spec.** Agree on the criteria with the team before writing any code. Change the spec, not the tests, when behaviour is unclear.
3. **Implement the tests.** Create `tests/<module>/<flow>.spec.ts`. Write one test per criterion, titled `<ID> <title>`, and link it with `spec('<module>/<flow>', '<ID>')` from `fixtures/spec.ts` (this adds the `@<ID>` tag). When criteria are sequential steps of one journey, cover them in a single test with one `test.step('<ID> …')` per criterion and pass all IDs to `spec()`. Use the `authedPage` fixture for anything behind login. Put selectors in `pages/`, never in the spec file. Set Status to `Implemented`.
4. **Check coverage.** Run `npm run spec:check`. It fails if a criterion has no test, or a test tag points at a criterion that doesn't exist.
5. **Run.** `npx playwright test tests/<module> --headed`, or `--grep @AUTH-03` for a single criterion.

When behaviour changes, update the spec first, then the test.

## Index

| Spec                                      | Prefix | Status      |
| ----------------------------------------- | ------ | ----------- |
| [Login & Logout](auth/login-logout.md)    | AUTH   | Implemented |
| [User list → Edit → Change Password](users/user-change-password.md) | USR | Implemented |
| [Distributor manager: reset password → direct sale](sales/dm-direct-sale.md) | SALE | Implemented |
| [Role-based UI](roles/role-based-ui.md) (expected UI per role in `data/roles.ts`) | ROLE | Implemented |
| [Admin: landing page and sidebar navigation](admin/admin-home-navigation.md) | ADM | Implemented |
| [Users list: controls, pagination and row actions](users/users-list.md) | ULIST | Implemented |
| [User creation: add user (one per role)](user-creation/add-user.md) (roles in `data/userRoles.ts`) | UADD | Implemented |
| [User creation: validation](user-creation/add-user-validation.md) | UVAL | Implemented |
| [User creation: form fields](user-creation/add-user-form.md) (sheet cases in `data/userModuleCases.ts`) | UFORM | Implemented |
| [User creation: attendance images (config)](user-creation/config/user-images.md) (`npm run test:user-creation:config`) | UIMG | Implemented |
| [User lifecycle: login, password change, deactivate / reactivate](users/user-lifecycle.md) (users in `data/automationUsers.ts`) | ULIFE | Implemented |
| [Edit user](users/edit-user.md) | UEDIT | Implemented |
| [Admin sets a user's password; inactive users can't log in](users/user-password-status.md) | UPST | Implemented |
| [Users list: Designation column with attendance_audit (config)](users/config/user-designation-column.md) (`npm run test:users:config`) | UDES | Implemented |
| [User details page](users/user-details.md) | UVIEW | Implemented |
| [User block: progressive lockout](user-block/progressive-lockout.md) (`npm run test:user-block`, on its own; attempts via `USER_BLOCK_ATTEMPTS`) | UBLK | Implemented |
| [Login settings (config)](config/login-settings.md) (`npm run test:config`; settings in `data/settings.ts`) | LCFG | Implemented |
| [Add Outlet: navigation from Organisation](add-outlet/navigation.md) | ONAV | Draft |

Open work for these modules is tracked in [`TODO.md`](../TODO.md).
