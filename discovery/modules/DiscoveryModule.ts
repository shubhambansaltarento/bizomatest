import type { Page } from '@playwright/test';
import type { DiscoveryConfig, RouteConfig } from '../../config/discoveryConfig';
import type { Logger } from '../logger';

/**
 * What a discovery module gets: the page already opened at the route (by RouteDiscoveryEngine,
 * read-only guard active), the route, and the configuration from ConfigLoader. Modules must not
 * navigate to hard-coded URLs or read process.env; everything comes from here.
 */
export interface DiscoveryContext {
  page: Page;
  route: RouteConfig;
  config: DiscoveryConfig;
  logger: Logger;
}

/** Extracts the configuration shown on one kind of page (one `discoveryType`). */
export interface DiscoveryModule {
  /** Must match a key of discovery.discoveryTypes in discovery-config.json. */
  readonly type: string;
  /** Returns plain, JSON-serialisable data; it is written into the route's snapshot. */
  discover(ctx: DiscoveryContext): Promise<Record<string, unknown>>;
}

/** Maps discovery types to modules. RouteDiscoveryEngine looks modules up here. */
export class DiscoveryModuleRegistry {
  private readonly modules = new Map<string, DiscoveryModule>();

  register(module: DiscoveryModule): this {
    if (this.modules.has(module.type)) throw new Error(`A discovery module for type "${module.type}" is already registered.`);
    this.modules.set(module.type, module);
    return this;
  }

  get(type: string): DiscoveryModule | undefined {
    return this.modules.get(type);
  }

  types(): string[] {
    return [...this.modules.keys()];
  }
}
