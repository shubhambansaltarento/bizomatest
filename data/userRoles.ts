import { automationUserPrefix, freshPassword } from './automationUsers';

/**
 * Roles an admin can give a new user on Users → New User (/users/add), and what each role must be
 * mapped to before the form can be saved. Source of truth for specs/users/add-user.md.
 *
 * Not the same as data/roles.ts: that file describes what a *logged-in* role should see; this one
 * describes the roles offered in the Add User form. To cover a new role, add an entry here; the
 * tests in tests/users/add-user.spec.ts pick up every entry automatically.
 *
 * `mapping` lists the dropdowns that appear after picking the role, in the order they appear.
 * `field` is the dropdown's label without "Select" and "*" (e.g. "Select ZONE *" → 'ZONE'), and
 * `option` is text contained in the option to pick. The values below exist on devarun
 * (checked 10 Nov 2026); another environment may need its own.
 */
export type MappingStep = { field: string; option: string };

export type AddUserRole = {
  /** Option text in the Role dropdown (also shown in the users list "Role" column). */
  label: string;
  /** Option value in the Role dropdown (`#UserRole`). */
  id: string;
  /** Dropdowns to fill after picking the role, in order. Empty when the role needs no mapping. */
  mapping: MappingStep[];
};

const zone: MappingStep = { field: 'ZONE', option: 'South' };
/** ZONE → Subzone → WAREHOUSE: roles that are mapped to a warehouse / distributor. */
const warehouse: MappingStep[] = [zone, { field: 'Subzone', option: 'Tamilnadu' }, { field: 'WAREHOUSE', option: 'Hexagon Warehouses' }];
/** Field roles are mapped down to an area; the area must belong to the chosen warehouse / distributor. */
const area = (warehouseLabel: 'WAREHOUSE' | 'DISTRIBUTOR'): MappingStep[] => [
  zone,
  { field: 'Subzone', option: 'Karnataka' },
  { field: warehouseLabel, option: 'Sri Ranga Distributors' },
  { field: 'AREA', option: 'SV Agencies' },
];

export const addUserRoles = [
  { label: 'ADMIN', id: '1', mapping: [] },
  { label: 'ZONE MANAGER', id: '2', mapping: [zone] },
  { label: 'WAREHOUSE MANAGER', id: '3', mapping: warehouse },
  { label: 'SALES MANAGER', id: '4', mapping: warehouse },
  { label: 'SALESMAN', id: '5', mapping: area('WAREHOUSE') },
  { label: 'DISTRIBUTOR MANAGER', id: '6', mapping: warehouse },
  { label: 'DISTRIBUTOR SALESMAN', id: '7', mapping: area('DISTRIBUTOR') },
  { label: 'DISTRIBUTOR SALES MANAGER', id: '8', mapping: warehouse },
  { label: 'REPORT ADMIN', id: '9', mapping: [] },
  { label: 'EXECUTION AUDITOR', id: '10', mapping: [] },
  { label: 'INVENTORY MANAGER', id: '11', mapping: [] },
  { label: 'VENDOR', id: '12', mapping: [] },
  { label: 'ERP API User', id: '14', mapping: [] },
] as const satisfies readonly AddUserRole[];

export type AddUserRoleLabel = (typeof addUserRoles)[number]['label'];

/**
 * Data for users created by the tests. Usernames start with the automation prefix (see
 * data/automationUsers.ts) and are unique per run so tests never collide.
 */
export const newUserData = {
  /** Allowed characters: letters, digits, @ . _ (the form rejects anything else). */
  username: (role: string) => `${automationUserPrefix}${role.toLowerCase().replace(/[^a-z]+/g, '')}.${Date.now().toString(36)}`,
  name: (role: string) => `E2E ${role}`,
  /** Meets the form's password rule (upper, lower, digit, special, 6+ characters). */
  get password() {
    return freshPassword();
  },
};
