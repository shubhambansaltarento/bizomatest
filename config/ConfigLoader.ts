import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  Credentials,
  type AllowedRequest,
  type AuthSelectors,
  type DiscoveryConfig,
  type LoginMode,
  type RouteConfig,
  type WaitUntil,
} from './discoveryConfig';

/** The bizom-e2e folder. Relative paths in the JSON configuration are resolved against it. */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'discovery-config.json');
const DEFAULT_ENV_FILE = path.join(PROJECT_ROOT, '.env');

/** Methods that must always be blocked in read-only mode. */
const REQUIRED_BLOCKED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const LOGIN_MODES: LoginMode[] = ['auto', 'manual'];
const WAIT_UNTIL: WaitUntil[] = ['load', 'domcontentloaded', 'networkidle', 'commit'];
const TOP_LEVEL_KEYS = [
  '$comment',
  'application',
  'browser',
  'authentication',
  'readOnly',
  'discovery',
  'output',
  'snapshot',
  'resume',
  'screenshots',
];

/** Thrown when configuration is missing or invalid. Lists every problem found, not just the first. */
export class ConfigError extends Error {
  constructor(readonly problems: string[], source: string) {
    super(
      `Discovery configuration is invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        `\nFix .env (see .env.example) and ${path.relative(PROJECT_ROOT, source) || source}.`,
    );
    this.name = 'ConfigError';
  }
}

export interface ConfigSources {
  /** Environment variables to read. Defaults to process.env after loading envFile into it. */
  env?: Record<string, string | undefined>;
  /** .env file loaded into process.env when `env` is not given. false skips loading. */
  envFile?: string | false;
  /** Path of the JSON configuration. Defaults to config/discovery-config.json. */
  configPath?: string;
  /** Already-parsed JSON configuration (tests); takes precedence over configPath. */
  rawConfig?: unknown;
}

/**
 * The single entry point to configuration for the discovery framework: loads .env and
 * config/discovery-config.json, validates them, resolves URLs and output paths, and returns one
 * read-only DiscoveryConfig. Discovery code receives that object; it never reads process.env or the
 * JSON file itself.
 *
 *   const config = ConfigLoader.get();          // cached, from .env + discovery-config.json
 *   const config = ConfigLoader.load({ env, rawConfig }); // explicit sources (tests)
 */
export class ConfigLoader {
  private static cached: DiscoveryConfig | undefined;

  /** The configuration from the default sources, loaded once per process. */
  static get(): DiscoveryConfig {
    ConfigLoader.cached ??= ConfigLoader.load();
    return ConfigLoader.cached;
  }

  static load(sources: ConfigSources = {}): DiscoveryConfig {
    const env = sources.env ?? loadEnvFile(sources.envFile ?? DEFAULT_ENV_FILE);
    const configPath = sources.rawConfig !== undefined ? '<inline>' : (sources.configPath ?? DEFAULT_CONFIG_PATH);
    const raw = sources.rawConfig !== undefined ? sources.rawConfig : readJson(configPath);
    return new Validator(env, raw, configPath).build();
  }

  /** BIZOM_BASE_URL + a configured path. Exposed for callers that resolve paths outside routes. */
  static resolveUrl(baseUrl: string, routePath: string): string {
    return `${baseUrl}${routePath}`;
  }
}

function loadEnvFile(envFile: string | false): Record<string, string | undefined> {
  if (envFile && fs.existsSync(envFile)) {
    // Existing environment variables win over .env, so CI can inject secrets.
    dotenv.config({ path: envFile, quiet: true });
  }
  return process.env;
}

function readJson(file: string): unknown {
  if (!fs.existsSync(file)) {
    throw new ConfigError([`Configuration file not found: ${file}`], file);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError([`Configuration file is not valid JSON: ${(e as Error).message}`], file);
  }
}

type Obj = Record<string, unknown>;

/** Walks the raw JSON, collecting every problem before failing. */
class Validator {
  private readonly problems: string[] = [];
  private readonly warnings: string[] = [];

  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly raw: unknown,
    private readonly source: string,
  ) {}

  build(): DiscoveryConfig {
    const root = this.obj(this.raw, '<root>');
    for (const key of Object.keys(root)) {
      if (!TOP_LEVEL_KEYS.includes(key)) this.warnings.push(`Unknown top-level key "${key}" in the configuration is ignored.`);
    }

    // --- .env -------------------------------------------------------------------------------
    const baseUrl = this.baseUrl();
    const credentials = new Credentials(this.env.BIZOM_USERNAME, this.env.BIZOM_PASSWORD);
    if (!credentials.available) {
      const missing = ['BIZOM_USERNAME', 'BIZOM_PASSWORD'].filter((k) => !this.env[k]);
      this.warnings.push(`${missing.join(' and ')} not set: automated login is disabled; only manual login is possible.`);
    }

    // --- JSON -------------------------------------------------------------------------------
    const application = this.obj(root.application, 'application');
    const browser = this.obj(root.browser, 'browser');
    const viewport = this.obj(browser.viewport, 'browser.viewport');
    const auth = this.obj(root.authentication, 'authentication');
    const sel = this.obj(auth.selectors, 'authentication.selectors');
    const mfa = this.obj(auth.mfa, 'authentication.mfa');
    const session = this.obj(auth.session, 'authentication.session');
    const readOnly = this.obj(root.readOnly, 'readOnly');
    const discovery = this.obj(root.discovery, 'discovery');
    const navigation = this.obj(discovery.navigation, 'discovery.navigation');
    const limits = this.obj(discovery.limits, 'discovery.limits');
    const output = this.obj(root.output, 'output');
    const snapshot = this.obj(root.snapshot, 'snapshot');
    const resume = this.obj(root.resume, 'resume');
    const screenshots = this.obj(root.screenshots, 'screenshots');

    const headless = this.envBoolean('HEADLESS') ?? this.bool(browser.headless, 'browser.headless');
    const loginTimeoutMs =
      this.envPositiveInt('LOGIN_TIMEOUT') ?? this.posInt(auth.loginTimeoutMs, 'authentication.loginTimeoutMs');

    const loginRoute = this.routePath(auth.loginRoute, 'authentication.loginRoute');
    const validationRoute = this.routePath(session.validationRoute, 'authentication.session.validationRoute');

    const selectors: AuthSelectors = {
      usernameInput: this.str(sel.usernameInput, 'authentication.selectors.usernameInput'),
      passwordInput: this.str(sel.passwordInput, 'authentication.selectors.passwordInput'),
      submitButton: this.str(sel.submitButton, 'authentication.selectors.submitButton'),
      loggedInIndicator: this.str(sel.loggedInIndicator, 'authentication.selectors.loggedInIndicator'),
      loginErrorMessages: this.strArray(sel.loginErrorMessages, 'authentication.selectors.loginErrorMessages'),
    };

    // Read-only mode is not optional during discovery.
    if (readOnly.enabled !== true) {
      this.problems.push('readOnly.enabled must be true: read-only mode cannot be disabled during discovery.');
    }
    const blockedMethods = this.strArray(readOnly.blockedMethods, 'readOnly.blockedMethods').map((m) => m.toUpperCase());
    const notBlocked = REQUIRED_BLOCKED_METHODS.filter((m) => !blockedMethods.includes(m));
    if (notBlocked.length) {
      this.problems.push(
        `readOnly.blockedMethods must include ${REQUIRED_BLOCKED_METHODS.join(', ')} (missing: ${notBlocked.join(', ')}). ` +
          'To let a read-only POST through, add it to readOnly.allowedRequests instead.',
      );
    }
    const blockedUrlPatterns = this.regexArray(readOnly.blockedUrlPatterns, 'readOnly.blockedUrlPatterns', true);

    const discoveryTypes = this.discoveryTypes(discovery.discoveryTypes);
    const routes = this.routes(discovery.routes, baseUrl, discoveryTypes, blockedUrlPatterns);

    const config: DiscoveryConfig = {
      application: {
        name: this.str(application.name, 'application.name'),
        environment: this.str(application.environment, 'application.environment'),
      },
      baseUrl,
      credentials,
      browser: {
        headless,
        viewport: {
          width: this.posInt(viewport.width, 'browser.viewport.width'),
          height: this.posInt(viewport.height, 'browser.viewport.height'),
        },
      },
      authentication: {
        loginRoute,
        loginUrl: ConfigLoader.resolveUrl(baseUrl, loginRoute),
        mode: this.oneOf(auth.mode, LOGIN_MODES, 'authentication.mode'),
        fallbackToManual: this.bool(auth.fallbackToManual, 'authentication.fallbackToManual'),
        loginTimeoutMs,
        selectors,
        mfa: {
          enabled: this.bool(mfa.enabled, 'authentication.mfa.enabled'),
          indicatorSelector: this.str(mfa.indicatorSelector, 'authentication.mfa.indicatorSelector'),
          timeoutMs: this.posInt(mfa.timeoutMs, 'authentication.mfa.timeoutMs'),
        },
        session: {
          saveStorageState: this.bool(session.saveStorageState, 'authentication.session.saveStorageState'),
          reuseStorageState: this.bool(session.reuseStorageState, 'authentication.session.reuseStorageState'),
          storageStatePath: this.filePath(session.storageStatePath, 'authentication.session.storageStatePath'),
          maxAgeMinutes: this.posInt(session.maxAgeMinutes, 'authentication.session.maxAgeMinutes'),
          validationRoute,
          validationUrl: ConfigLoader.resolveUrl(baseUrl, validationRoute),
        },
      },
      readOnly: {
        enabled: true,
        blockedMethods,
        allowedRequests: this.allowedRequests(readOnly),
        blockedUrlPatterns,
      },
      discovery: {
        discoveryTypes,
        navigation: {
          waitUntil: this.oneOf(navigation.waitUntil, WAIT_UNTIL, 'discovery.navigation.waitUntil'),
          timeoutMs: this.posInt(navigation.timeoutMs, 'discovery.navigation.timeoutMs'),
          networkIdleTimeoutMs: this.nonNegInt(navigation.networkIdleTimeoutMs, 'discovery.navigation.networkIdleTimeoutMs'),
          loadingSelectors: this.strArray(navigation.loadingSelectors, 'discovery.navigation.loadingSelectors'),
          failOnBlockedRequests: this.bool(navigation.failOnBlockedRequests, 'discovery.navigation.failOnBlockedRequests'),
          flashMessageSelectors: this.strArray(navigation.flashMessageSelectors, 'discovery.navigation.flashMessageSelectors'),
          errorTextPatterns: this.regexArray(navigation.errorTextPatterns, 'discovery.navigation.errorTextPatterns', false, 'i'),
        },
        limits: {
          maxRoutesPerRun: this.posInt(limits.maxRoutesPerRun, 'discovery.limits.maxRoutesPerRun'),
          maxRetriesPerRoute: this.nonNegInt(limits.maxRetriesPerRoute, 'discovery.limits.maxRetriesPerRoute'),
          delayBetweenRoutesMs: this.nonNegInt(limits.delayBetweenRoutesMs, 'discovery.limits.delayBetweenRoutesMs'),
          runTimeoutMs: this.posInt(limits.runTimeoutMs, 'discovery.limits.runTimeoutMs'),
        },
        routes,
      },
      output: {
        rootDir: this.filePath(output.rootDir, 'output.rootDir'),
        snapshotsDir: this.filePath(output.snapshotsDir, 'output.snapshotsDir'),
        screenshotsDir: this.filePath(output.screenshotsDir, 'output.screenshotsDir'),
        reportsDir: this.filePath(output.reportsDir, 'output.reportsDir'),
        stateDir: this.filePath(output.stateDir, 'output.stateDir'),
      },
      snapshot: {
        enabled: this.bool(snapshot.enabled, 'snapshot.enabled'),
        format: this.oneOf(snapshot.format, ['json'] as const, 'snapshot.format'),
        includeHtml: this.bool(snapshot.includeHtml, 'snapshot.includeHtml'),
      },
      resume: {
        enabled: this.bool(resume.enabled, 'resume.enabled'),
        skipCompleted: this.bool(resume.skipCompleted, 'resume.skipCompleted'),
      },
      screenshots: {
        enabled: this.bool(screenshots.enabled, 'screenshots.enabled'),
        fullPage: this.bool(screenshots.fullPage, 'screenshots.fullPage'),
        onFailure: this.bool(screenshots.onFailure, 'screenshots.onFailure'),
      },
      warnings: this.warnings,
      source: this.source,
    };

    if (this.problems.length) throw new ConfigError(this.problems, this.source);
    return Object.freeze(config);
  }

  // --- .env values ----------------------------------------------------------------------------

  private baseUrl(): string {
    const value = this.env.BIZOM_BASE_URL?.trim();
    if (!value) {
      this.problems.push('BIZOM_BASE_URL is not set in .env: discovery cannot start without the application URL.');
      return '';
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      this.problems.push(`BIZOM_BASE_URL is not a valid URL: "${value}".`);
      return '';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      this.problems.push(`BIZOM_BASE_URL must start with http:// or https:// (got "${url.protocol}").`);
    }
    if (url.search || url.hash || url.username || url.password) {
      this.problems.push('BIZOM_BASE_URL must not contain a query string, fragment or credentials.');
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  private envBoolean(name: string): boolean | undefined {
    const value = this.env[name]?.trim().toLowerCase();
    if (!value) return undefined;
    if (['true', '1', 'yes'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    this.problems.push(`${name} must be true or false (got "${this.env[name]}").`);
    return undefined;
  }

  private envPositiveInt(name: string): number | undefined {
    const value = this.env[name]?.trim();
    if (!value) return undefined;
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      this.problems.push(`${name} must be a positive whole number of milliseconds (got "${value}").`);
      return undefined;
    }
    return Number(value);
  }

  // --- JSON values ----------------------------------------------------------------------------

  private obj(value: unknown, at: string): Obj {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Obj;
    this.problems.push(`${at} is missing or not an object.`);
    return {};
  }

  private str(value: unknown, at: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    this.problems.push(`${at} is missing or empty.`);
    return '';
  }

  private bool(value: unknown, at: string): boolean {
    if (typeof value === 'boolean') return value;
    this.problems.push(`${at} must be true or false.`);
    return false;
  }

  private posInt(value: unknown, at: string): number {
    if (Number.isInteger(value) && (value as number) > 0) return value as number;
    this.problems.push(`${at} must be a positive whole number.`);
    return 0;
  }

  private nonNegInt(value: unknown, at: string): number {
    if (Number.isInteger(value) && (value as number) >= 0) return value as number;
    this.problems.push(`${at} must be a whole number, 0 or more.`);
    return 0;
  }

  private oneOf<T extends string>(value: unknown, allowed: readonly T[], at: string): T {
    if (allowed.includes(value as T)) return value as T;
    this.problems.push(`${at} must be one of ${allowed.map((a) => `"${a}"`).join(', ')} (got ${JSON.stringify(value)}).`);
    return allowed[0];
  }

  private strArray(value: unknown, at: string): string[] {
    if (Array.isArray(value) && value.length && value.every((v) => typeof v === 'string' && v.trim())) return value;
    this.problems.push(`${at} must be a non-empty list of non-empty strings.`);
    return [];
  }

  private regexArray(value: unknown, at: string, required: boolean, flags = 'i'): RegExp[] {
    if (!Array.isArray(value) || (required && !value.length)) {
      this.problems.push(`${at} must be a ${required ? 'non-empty ' : ''}list of regular expressions.`);
      return [];
    }
    return value.flatMap((v, i) => {
      try {
        if (typeof v !== 'string' || !v) throw new Error('not a non-empty string');
        return [new RegExp(v, flags)];
      } catch (e) {
        this.problems.push(`${at}[${i}] is not a valid regular expression: ${(e as Error).message}`);
        return [];
      }
    });
  }

  /** A path inside the application: starts with one '/', no scheme or host. */
  private routePath(value: unknown, at: string): string {
    const p = this.str(value, at);
    if (p && (!p.startsWith('/') || p.startsWith('//') || /^[a-z]+:/i.test(p) || p.includes('://'))) {
      this.problems.push(`${at} must be a path starting with "/" (got "${p}"); the host comes from BIZOM_BASE_URL.`);
    }
    return p;
  }

  private filePath(value: unknown, at: string): string {
    const p = this.str(value, at);
    return p ? path.resolve(PROJECT_ROOT, p) : '';
  }

  private allowedRequests(readOnly: Obj): AllowedRequest[] {
    if (readOnly.allowedRequestPatterns !== undefined) {
      this.problems.push('readOnly.allowedRequestPatterns was replaced by readOnly.allowedRequests ({ pathPattern, bodyPattern?, reason }).');
    }
    const list = readOnly.allowedRequests;
    if (!Array.isArray(list)) {
      this.problems.push('readOnly.allowedRequests must be a list (it may be empty).');
      return [];
    }
    return list.map((item, i): AllowedRequest => {
      const at = `readOnly.allowedRequests[${i}]`;
      const o = this.obj(item, at);
      const [pathPattern] = this.regexArray([this.str(o.pathPattern, `${at}.pathPattern`)], `${at}.pathPattern`, true);
      const bodyPattern = o.bodyPattern === undefined ? undefined : this.regexArray([o.bodyPattern], `${at}.bodyPattern`, true)[0];
      if (pathPattern && !pathPattern.source.startsWith('^')) {
        this.problems.push(`${at}.pathPattern must start with "^" so it matches a whole path, not part of one (got "${pathPattern.source}").`);
      }
      return {
        pathPattern: pathPattern ?? /$^/,
        ...(bodyPattern ? { bodyPattern } : {}),
        reason: this.str(o.reason, `${at}.reason`),
      };
    });
  }

  private discoveryTypes(value: unknown): Record<string, { description: string }> {
    const types = this.obj(value, 'discovery.discoveryTypes');
    if (!Object.keys(types).length) this.problems.push('discovery.discoveryTypes must declare at least one type.');
    return Object.fromEntries(
      Object.entries(types).map(([name, def]) => [
        name,
        { description: this.str(this.obj(def, `discovery.discoveryTypes.${name}`).description, `discovery.discoveryTypes.${name}.description`) },
      ]),
    );
  }

  private routes(
    value: unknown,
    baseUrl: string,
    types: Record<string, unknown>,
    blockedUrlPatterns: RegExp[],
  ): RouteConfig[] {
    if (!Array.isArray(value) || !value.length) {
      this.problems.push('discovery.routes is missing or empty: configure at least one route.');
      return [];
    }
    const seen = new Set<string>();
    const routes = value.map((item, i): RouteConfig => {
      const r = this.obj(item, `discovery.routes[${i}]`);
      const id = this.str(r.id, `discovery.routes[${i}].id`);
      const at = `discovery.routes[${id || i}]`;
      if (id && seen.has(id)) this.problems.push(`${at}: duplicate route id "${id}".`);
      seen.add(id);
      const routePath = this.routePath(r.path, `${at}.path`);
      if (routePath && blockedUrlPatterns.some((re) => re.test(routePath))) {
        this.problems.push(`${at}.path "${routePath}" matches readOnly.blockedUrlPatterns; discovery may not open it.`);
      }
      const discoveryType = this.str(r.discoveryType, `${at}.discoveryType`);
      if (discoveryType && !(discoveryType in types)) {
        this.problems.push(
          `${at}.discoveryType "${discoveryType}" is not declared in discovery.discoveryTypes (${Object.keys(types).join(', ') || 'none'}).`,
        );
      }
      if (r.readySelector !== undefined) this.str(r.readySelector, `${at}.readySelector`);
      const readyState = r.readyState === undefined ? 'visible' : this.oneOf(r.readyState, ['visible', 'attached'] as const, `${at}.readyState`);
      if (r.fullPageScreenshot !== undefined) this.bool(r.fullPageScreenshot, `${at}.fullPageScreenshot`);
      return {
        id,
        name: this.str(r.name, `${at}.name`),
        path: routePath,
        discoveryType,
        enabled: this.bool(r.enabled, `${at}.enabled`),
        ...(typeof r.readySelector === 'string' && r.readySelector ? { readySelector: r.readySelector } : {}),
        readyState,
        ...(typeof r.fullPageScreenshot === 'boolean' ? { fullPageScreenshot: r.fullPageScreenshot } : {}),
        url: ConfigLoader.resolveUrl(baseUrl, routePath),
      };
    });
    if (routes.length && !routes.some((r) => r.enabled)) {
      this.warnings.push('Every route in discovery.routes is disabled: nothing will be discovered.');
    }
    return routes;
  }
}
