import type { RoleName } from './roles';

/**
 * Test data for the add-outlet module (specs/add-outlet/): per role, where an area sits in
 * Dashboard → Organisation, and an existing outlet in that area that the tests open (never change).
 *
 * The values are devarun's (checked 18 Nov 2026). The DM's path must belong to the DM account in
 * .env (DM_USERNAME, pricing.distributor): a DM only sees their own zones in Organisation.
 */

/** Sidebar item that opens the Organisation tree. */
export const organisationMenu = { section: 'Dashboard', item: 'Organisation' } as const;

/** Path to an area in the Organisation tree: zone → subzone (if any) → warehouse / distributor → area. */
export type OrgAreaPath = {
  zone: string;
  /** Omit for warehouses listed directly under the zone ("No Subzone"). */
  subzone?: string;
  /** Warehouse or distributor name as shown in the tree (distributors end in " DISTRIBUTOR"). */
  warehouse: string;
  /** Area id (from its row, also used in /outlets/add/<id>) and its name. */
  area: { id: number; name: string };
};

export type OutletNavigationData = {
  path: OrgAreaPath;
  /** An outlet listed under `path.area`, opened by the Edit Outlet tests. */
  outlet: { id: number; name: string };
  /** Set while this role can't open Edit Outlet: the Edit tests then run as expected failures. */
  editKnownIssue?: string;
};

export const outletNavigation = {
  admin: {
    path: {
      zone: 'South',
      subzone: 'Karnataka',
      warehouse: 'Sri Ranga Distributors DISTRIBUTOR',
      area: { id: 1, name: 'SV Agencies' },
    },
    outlet: { id: 3, name: 'Venus Utility store' },
  },

  distributorManager: {
    path: {
      zone: 'Pricing Zone',
      subzone: 'Pricing_Sub_Zone',
      warehouse: 'Pricing Warehouse 1',
      area: { id: 4, name: 'Pricing Area 1' },
    },
    outlet: { id: 222, name: 'Pricing_Outlet_1' },
    editKnownIssue:
      'DM is refused (18 Nov 2026): "You do not have sufficient permission to edit an OUTLET.", no Edit Outlet icon. ' +
      'Awaiting confirmation whether a DM should edit outlets (URL permission?). See TODO.md',
  },
} satisfies Partial<Record<RoleName, OutletNavigationData>>;
