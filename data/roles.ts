import { env } from '../config/env';

/**
 * Expected UI per user role. This is the source of truth for specs/roles/role-based-ui.md.
 *
 * To add a role: add an entry below (and its account to .env). To change what a role should
 * see: edit its lists. The tests in tests/roles/ pick up every entry automatically.
 *
 * Lists are compared exactly and in order: an item missing from the app, or an extra item
 * in the app, fails the test.
 */
export type RoleConfig = {
  /** Text after "you are" in the top banner. */
  label: string;
  /** Account used to log in as this role. */
  credentials: () => { username: string; password: string };
  /** Page shown right after login. */
  landingPath: string;
  /** Sidebar → Main Menu: section name → its sub-items ([] when the section has none). */
  sidebar: Record<string, string[]>;
  /** User menu (person icon, top right). */
  userMenu: string[];
  /** Sidebar items whose link redirects to another URL that is the right page: item → final path. */
  sidebarRedirects?: Record<string, string>;
  /** Sidebar items whose page is known to be broken: item → reason. Tested as expected failures (ADM-02). */
  sidebarKnownIssues?: Record<string, string>;
  /** Pages of other roles that this role must not be able to open by URL. */
  blockedPages: { path: string; name: string; knownIssue?: string }[];
};

export const roles = {
  admin: {
    label: 'ADMIN',
    credentials: () => ({ username: env.username, password: env.password }),
    landingPath: '/users/ajaxuserindex',
    sidebar: {
      Users: [],
      Dashboard: [
        'Dashboard',
        'Users',
        'Organisation',
        'Unapproved Outlets',
        'Outlet Density Map',
        'Update User Targets',
        'Set Outlet Targets',
      ],
      Inventory: ['Inventory', 'Set Inventory Alert'],
      Products: [
        'Products',
        'Add Product',
        'List Categories',
        'List Variants',
        'List Sizes',
        'List Brands',
        'List Collaterals',
        'List Pop',
        'Price Change',
        'List Batches',
        'List Packaging',
        'List Units',
      ],
      Reports: [],
      Discounts: [
        'Discounts',
        'New Discount',
        'Discount Categories',
        'New Discount Category',
        'Schemes',
        'New Scheme',
        'Assign Schemes',
        'Scheme holders',
      ],
    },
    userMenu: ['Settings', 'Billing', 'Change Password', 'Contact Support', 'Logout'],
    sidebarRedirects: { 'New Scheme': '/schemes/addscheme' },
    sidebarKnownIssues: {
      'Set Outlet Targets':
        'Page loads without jQuery (10 Nov 2026): "jQuery is not defined", no navbar, sidebar or styles',
    },
    blockedPages: [],
  },

  distributorManager: {
    label: 'DISTRIBUTOR MANAGER',
    credentials: () => ({ username: env.dmUsername, password: env.dmNewPassword }),
    landingPath: '/users/ajaxuserindex',
    sidebar: {
      Users: [],
      Dashboard: ['Dashboard', 'Users', 'Organisation'],
      Inventory: ['Inventory'],
      Reports: [],
      Today: ['List Orders'],
      Collection: ['Collection'],
    },
    userMenu: ['Change Password', 'Contact Support', 'Logout'],
    blockedPages: [
      { path: '/skunits/ajaxskuindex', name: 'Products' },
      { path: '/skunits/add', name: 'Add Product' },
      { path: '/discounts/index', name: 'Discounts' },
      { path: '/outlets/viewunapprovedoutlets', name: 'Unapproved Outlets' },
      {
        path: '/targets/updatetargets',
        name: 'Update User Targets',
        knownIssue: 'Opens for DISTRIBUTOR MANAGER by URL (22 Oct 2026); awaiting product confirmation',
      },
    ],
  },
} satisfies Record<string, RoleConfig>;

export type RoleName = keyof typeof roles;
