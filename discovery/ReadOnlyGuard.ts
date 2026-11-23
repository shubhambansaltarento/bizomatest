import type { BrowserContext, Route } from '@playwright/test';
import type { DiscoveryConfig } from '../config/discoveryConfig';
import type { Logger } from './logger';

export interface BlockedRequest {
  method: string;
  /** Path only: query strings can hold tokens, so they are not recorded. */
  path: string;
  resourceType: string;
  reason: 'method' | 'url';
}

/**
 * Enforces read-only mode on a browser context: aborts every request that could change data in
 * the application (blocked methods unless allow-listed, and blocked URLs such as logout or delete
 * links) and records what it blocked. Installed by RouteDiscoveryEngine after login and before the
 * first discovery navigation.
 */
export class ReadOnlyGuard {
  readonly blocked: BlockedRequest[] = [];
  private installedOn: BrowserContext | undefined;
  private readonly handler = (route: Route) => this.handle(route);

  constructor(
    private readonly config: DiscoveryConfig,
    private readonly logger: Logger,
  ) {
    if (config.readOnly.enabled !== true) {
      // ConfigLoader already refuses this; checked again so the guard can never run disabled.
      throw new Error('Read-only mode is disabled; discovery refuses to run.');
    }
  }

  async install(context: BrowserContext) {
    if (this.installedOn) throw new Error('ReadOnlyGuard is already installed.');
    await context.route('**/*', this.handler);
    this.installedOn = context;
  }

  async uninstall() {
    await this.installedOn?.unroute('**/*', this.handler);
    this.installedOn = undefined;
  }

  /** Requests blocked since `since` (an index into `blocked`). */
  blockedSince(since: number): BlockedRequest[] {
    return this.blocked.slice(since);
  }

  /** Whether a request would be blocked, and why. Exposed for tests. */
  verdict(method: string, url: string, body: string | null = null): BlockedRequest['reason'] | undefined {
    const { blockedMethods, allowedRequests, blockedUrlPatterns } = this.config.readOnly;
    const pathname = safePath(url);
    if (blockedUrlPatterns.some((re) => re.test(pathname))) return 'url';
    if (!blockedMethods.includes(method.toUpperCase())) return undefined;
    const allowed = allowedRequests.some(
      (a) => a.pathPattern.test(pathname) && (!a.bodyPattern || (body !== null && a.bodyPattern.test(body))),
    );
    return allowed ? undefined : 'method';
  }

  private async handle(route: Route) {
    const request = route.request();
    const reason = this.verdict(request.method(), request.url(), request.postData());
    if (!reason) return route.fallback();
    const entry: BlockedRequest = {
      method: request.method(),
      path: safePath(request.url()),
      resourceType: request.resourceType(),
      reason,
    };
    this.blocked.push(entry);
    this.logger.warn(
      `Read-only: blocked ${entry.method} ${entry.path} (${reason === 'url' ? 'blocked URL' : 'blocked method; if it only reads data, add it to readOnly.allowedRequests'})`,
    );
    await route.abort('blockedbyclient');
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}
