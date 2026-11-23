import { inspect } from 'node:util';

/**
 * Types of the validated discovery configuration produced by ConfigLoader.
 * The values themselves live in config/discovery-config.json and .env; nothing here holds data.
 */

export type LoginMode = 'auto' | 'manual';
export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface RouteConfig {
  id: string;
  name: string;
  /** Path relative to the base URL, always starting with '/'. */
  path: string;
  discoveryType: string;
  enabled: boolean;
  /** Optional selector that must reach readyState before the page counts as loaded (its data, not just its frame). */
  readySelector?: string;
  /** 'visible' (default) or 'attached' (in the page but possibly hidden, e.g. in a collapsed section). */
  readyState: 'visible' | 'attached';
  /** Overrides screenshots.fullPage for this route (e.g. very long tables). */
  fullPageScreenshot?: boolean;
  /** Absolute URL: BIZOM_BASE_URL + path. Filled in by ConfigLoader. */
  url: string;
}

/** A request read-only mode lets through although its method is blocked, because it only reads data. */
export interface AllowedRequest {
  pathPattern: RegExp;
  /** When set, the request body must match too. */
  bodyPattern?: RegExp;
  reason: string;
}

export interface AuthSelectors {
  usernameInput: string;
  passwordInput: string;
  submitButton: string;
  loggedInIndicator: string;
  loginErrorMessages: string[];
}

export interface DiscoveryConfig {
  application: { name: string; environment: string };
  /** BIZOM_BASE_URL without a trailing slash. */
  baseUrl: string;
  credentials: Credentials;
  browser: { headless: boolean; viewport: { width: number; height: number } };
  authentication: {
    loginRoute: string;
    loginUrl: string;
    mode: LoginMode;
    fallbackToManual: boolean;
    loginTimeoutMs: number;
    selectors: AuthSelectors;
    mfa: { enabled: boolean; indicatorSelector: string; timeoutMs: number };
    session: {
      saveStorageState: boolean;
      reuseStorageState: boolean;
      /** Absolute path. */
      storageStatePath: string;
      maxAgeMinutes: number;
      validationRoute: string;
      validationUrl: string;
    };
  };
  readOnly: {
    enabled: true;
    blockedMethods: string[];
    allowedRequests: AllowedRequest[];
    blockedUrlPatterns: RegExp[];
  };
  discovery: {
    discoveryTypes: Record<string, { description: string }>;
    navigation: {
      waitUntil: WaitUntil;
      timeoutMs: number;
      /** 0 = don't wait for network idle. */
      networkIdleTimeoutMs: number;
      loadingSelectors: string[];
      failOnBlockedRequests: boolean;
      /** App flash banners: recorded, not treated as page errors (they can belong to an earlier request). */
      flashMessageSelectors: string[];
      errorTextPatterns: RegExp[];
    };
    limits: {
      maxRoutesPerRun: number;
      maxRetriesPerRoute: number;
      delayBetweenRoutesMs: number;
      runTimeoutMs: number;
    };
    /** Every configured route, enabled or not. Use RouteDiscoveryEngine.plan() to get what runs. */
    routes: RouteConfig[];
  };
  /** All absolute paths. */
  output: { rootDir: string; snapshotsDir: string; screenshotsDir: string; reportsDir: string; stateDir: string };
  snapshot: { enabled: boolean; format: 'json'; includeHtml: boolean };
  resume: { enabled: boolean; skipCompleted: boolean };
  screenshots: { enabled: boolean; fullPage: boolean; onFailure: boolean };
  /** Non-fatal findings from validation (e.g. credentials missing, so only manual login is possible). */
  warnings: string[];
  /** Where the JSON configuration was read from (absolute path), or '<inline>' in tests. */
  source: string;
}

/**
 * Username and password from .env. The values are kept in private fields so that logging,
 * JSON.stringify or util.inspect of the config never prints them.
 */
export class Credentials {
  readonly #username: string | undefined;
  readonly #password: string | undefined;

  constructor(username: string | undefined, password: string | undefined) {
    this.#username = username || undefined;
    this.#password = password || undefined;
  }

  /** True when both username and password are set, i.e. automated login is possible. */
  get available(): boolean {
    return Boolean(this.#username && this.#password);
  }

  get username(): string {
    if (!this.#username) throw new Error('BIZOM_USERNAME is not set; automated login is not possible.');
    return this.#username;
  }

  get password(): string {
    if (!this.#password) throw new Error('BIZOM_PASSWORD is not set; automated login is not possible.');
    return this.#password;
  }

  /** Values to scrub from any log line or written file. */
  secrets(): string[] {
    return [this.#password, this.#username].filter((s): s is string => Boolean(s));
  }

  /** Username shown as "ad***" in logs. */
  get maskedUsername(): string {
    return this.#username ? `${this.#username.slice(0, 2)}***` : '<not set>';
  }

  toJSON() {
    return { username: this.maskedUsername, password: this.#password ? '***' : '<not set>' };
  }

  [inspect.custom]() {
    return `Credentials ${JSON.stringify(this.toJSON())}`;
  }
}
