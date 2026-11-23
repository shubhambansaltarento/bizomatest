import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';
import { test, expect, type Page } from '@playwright/test';
import { ConfigError, ConfigLoader } from '../../config/ConfigLoader';
import type { DiscoveryConfig } from '../../config/discoveryConfig';
import { createLogger } from '../../discovery/logger';
import { DiscoveryModuleRegistry } from '../../discovery/modules/DiscoveryModule';
import { ReadOnlyGuard } from '../../discovery/ReadOnlyGuard';
import { RouteDiscoveryEngine } from '../../discovery/RouteDiscoveryEngine';
import { LoginError, SessionManager } from '../../discovery/SessionManager';
import { spec } from '../../fixtures/spec';

/*
 * Startup validation of the discovery framework. No browser, no network: every case loads made-up
 * configuration built from the real config/discovery-config.json.
 */

const SPEC = 'discovery/config-auth-navigation';
const CONFIG_FILE = path.resolve(__dirname, '../../config/discovery-config.json');

/** Obviously fake values; never real credentials. */
const FAKE_ENV = {
  BIZOM_BASE_URL: 'https://bizom.example.test/',
  BIZOM_USERNAME: 'fake.user',
  BIZOM_PASSWORD: 'Fake-Pass-123',
};

type Json = Record<string, any>;

function rawConfig(edit?: (c: Json) => void): Json {
  const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Json;
  edit?.(c);
  return c;
}

function load(env: Record<string, string | undefined> = FAKE_ENV, edit?: (c: Json) => void): DiscoveryConfig {
  return ConfigLoader.load({ env, rawConfig: rawConfig(edit) });
}

/** The ConfigError problems thrown by a load, joined, or fails if it loads. */
function problemsOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as ConfigError).problems.join('\n');
  }
  throw new Error('Expected a ConfigError, but the configuration loaded.');
}

const silentLogger = (config: DiscoveryConfig) => createLogger(config, () => undefined);

test.describe('discovery configuration', () => {
  test('DISC-01 Missing or invalid environment values stop startup', spec(SPEC, 'DISC-01'), () => {
    expect(problemsOf(() => load({ ...FAKE_ENV, BIZOM_BASE_URL: undefined }))).toContain('BIZOM_BASE_URL is not set');
    expect(problemsOf(() => load({ ...FAKE_ENV, BIZOM_BASE_URL: 'not a url' }))).toContain('BIZOM_BASE_URL is not a valid URL');
    expect(problemsOf(() => load({ ...FAKE_ENV, BIZOM_BASE_URL: 'ftp://bizom.example.test' }))).toContain('http:// or https://');

    const bad = problemsOf(() => load({ ...FAKE_ENV, HEADLESS: 'maybe', LOGIN_TIMEOUT: '10s' }));
    expect(bad).toContain('HEADLESS must be true or false');
    expect(bad).toContain('LOGIN_TIMEOUT must be a positive whole number');

    const config = load({ ...FAKE_ENV, HEADLESS: 'false', LOGIN_TIMEOUT: '12345' });
    expect(config.browser.headless).toBe(false);
    expect(config.authentication.loginTimeoutMs).toBe(12345);
    expect(config.baseUrl).toBe('https://bizom.example.test');
    expect(config.authentication.loginUrl).toBe(`https://bizom.example.test${config.authentication.loginRoute}`);
    for (const route of config.discovery.routes) {
      expect(route.url).toBe(`https://bizom.example.test${route.path}`);
    }
    // The configured routes are the ones requested for this phase, read from JSON.
    expect(config.discovery.routes.map((r) => r.path)).toEqual(
      rawConfig().discovery.routes.map((r: Json) => r.path),
    );
  });

  test('DISC-02 Missing credentials stop automated login only', spec(SPEC, 'DISC-02'), () => {
    const noCreds = { BIZOM_BASE_URL: FAKE_ENV.BIZOM_BASE_URL };

    const headed = load({ ...noCreds, HEADLESS: 'false' });
    expect(headed.credentials.available).toBe(false);
    expect(headed.warnings.join('\n')).toContain('automated login is disabled');
    expect(new SessionManager(headed, silentLogger(headed)).loginMethod()).toBe('manual');

    const headless = load({ ...noCreds, HEADLESS: 'true' });
    expect(() => new SessionManager(headless, silentLogger(headless)).loginMethod()).toThrow(LoginError);
    expect(() => new SessionManager(headless, silentLogger(headless)).loginMethod()).toThrow(/BIZOM_USERNAME and BIZOM_PASSWORD.*HEADLESS=false/);

    const noFallback = load({ ...noCreds, HEADLESS: 'false' }, (c) => (c.authentication.fallbackToManual = false));
    expect(() => new SessionManager(noFallback, silentLogger(noFallback)).loginMethod()).toThrow(/fallbackToManual/);

    const withCreds = load();
    expect(new SessionManager(withCreds, silentLogger(withCreds)).loginMethod()).toBe('auto');

    // Manual mode works with or without credentials, but needs a visible browser.
    const manual = load({ ...FAKE_ENV, HEADLESS: 'false' }, (c) => (c.authentication.mode = 'manual'));
    expect(new SessionManager(manual, silentLogger(manual)).loginMethod()).toBe('manual');

    // The configuration never prints the credentials.
    for (const printed of [JSON.stringify(withCreds), inspect(withCreds, { depth: 10 }), String(withCreds.credentials)]) {
      expect(printed).not.toContain(FAKE_ENV.BIZOM_PASSWORD);
      expect(printed).not.toContain(FAKE_ENV.BIZOM_USERNAME);
    }
    const lines: string[] = [];
    createLogger(withCreds, (_l, line) => lines.push(line)).error(`login failed for ${FAKE_ENV.BIZOM_USERNAME}/${FAKE_ENV.BIZOM_PASSWORD}`);
    expect(lines[0]).toBe('[discovery] ERROR login failed for ***/***');
  });

  test('DISC-03 Missing or invalid route configuration is an error', spec(SPEC, 'DISC-03'), () => {
    expect(problemsOf(() => load(FAKE_ENV, (c) => delete c.discovery.routes))).toContain('discovery.routes is missing or empty');
    expect(problemsOf(() => load(FAKE_ENV, (c) => (c.discovery.routes = [])))).toContain('discovery.routes is missing or empty');

    const bad = problemsOf(() =>
      load(FAKE_ENV, (c) => {
        const [a, b, d] = c.discovery.routes;
        a.path = 'settings/allsettings';
        b.path = 'https://evil.example/settings';
        delete d.enabled;
        c.discovery.routes[3].discoveryType = 'no-such-type';
        c.discovery.routes.push({ ...c.discovery.routes[3], discoveryType: 'settings-index' });
      }),
    );
    expect(bad).toContain('must be a path starting with "/" (got "settings/allsettings")');
    expect(bad).toContain('(got "https://evil.example/settings")');
    expect(bad).toMatch(/enabled must be true or false/);
    expect(bad).toContain('"no-such-type" is not declared in discovery.discoveryTypes');
    expect(bad).toContain('duplicate route id');

    expect(problemsOf(() => load(FAKE_ENV, (c) => delete c.authentication.loginRoute))).toContain('authentication.loginRoute is missing');
    expect(problemsOf(() => load(FAKE_ENV, (c) => delete c.authentication.selectors.submitButton))).toContain(
      'authentication.selectors.submitButton is missing',
    );
    expect(problemsOf(() => ConfigLoader.load({ env: FAKE_ENV, configPath: '/nonexistent/discovery-config.json' }))).toContain(
      'Configuration file not found',
    );
  });

  test('DISC-04 Disabled routes do not execute', spec(SPEC, 'DISC-04'), async () => {
    const config = load(FAKE_ENV, (c) => {
      c.discovery.routes.find((r: Json) => r.id === 'form-definitions').enabled = false;
    });
    const logger = silentLogger(config);
    const engine = new RouteDiscoveryEngine(config, new DiscoveryModuleRegistry(), new SessionManager(config, logger), logger);
    const plan = engine.plan('navigate');
    expect(plan.toRun.map((r) => r.id)).not.toContain('form-definitions');
    expect(plan.toRun.map((r) => r.id)).toEqual(config.discovery.routes.filter((r) => r.enabled).map((r) => r.id));
    expect(plan.skipped).toEqual([{ route: expect.objectContaining({ id: 'form-definitions' }), reason: 'disabled' }]);

    const allOff = load(FAKE_ENV, (c) => c.discovery.routes.forEach((r: Json) => (r.enabled = false)));
    expect(allOff.warnings.join('\n')).toContain('Every route in discovery.routes is disabled');
    const offLogger = silentLogger(allOff);
    const offEngine = new RouteDiscoveryEngine(allOff, new DiscoveryModuleRegistry(), new SessionManager(allOff, offLogger), offLogger);
    expect(offEngine.plan('navigate').toRun).toEqual([]);
    // Refuses before touching the browser, so no page is needed.
    await expect(offEngine.run(undefined as unknown as Page, { mode: 'navigate' })).rejects.toThrow('No enabled routes');
  });

  test('DISC-05 Read-only mode cannot be switched off', spec(SPEC, 'DISC-05'), () => {
    expect(problemsOf(() => load(FAKE_ENV, (c) => (c.readOnly.enabled = false)))).toContain('readOnly.enabled must be true');
    expect(problemsOf(() => load(FAKE_ENV, (c) => delete c.readOnly.enabled))).toContain('readOnly.enabled must be true');
    expect(problemsOf(() => load(FAKE_ENV, (c) => (c.readOnly.blockedMethods = ['PUT', 'DELETE'])))).toContain('missing: POST, PATCH');
    expect(
      problemsOf(() => load(FAKE_ENV, (c) => (c.discovery.routes[0].path = '/users/logout'))),
    ).toContain('matches readOnly.blockedUrlPatterns');

    expect(problemsOf(() => load(FAKE_ENV, (c) => (c.readOnly.allowedRequestPatterns = ['^/x$'])))).toContain('was replaced by readOnly.allowedRequests');
    expect(
      problemsOf(() => load(FAKE_ENV, (c) => (c.readOnly.allowedRequests = [{ pathPattern: '/list', reason: 'r' }]))),
    ).toContain('must start with "^"');

    const config = load(FAKE_ENV, (c) => {
      c.readOnly.allowedRequests = [
        { pathPattern: '^/reports/list$', reason: 'read by POST' },
        { pathPattern: '^/items/index$', bodyPattern: '(^|&)draw=\\d+(&|$)', reason: 'DataTables read' },
      ];
    });
    const guard = new ReadOnlyGuard(config, silentLogger(config));
    const url = (p: string) => `${config.baseUrl}${p}?token=x`;
    expect(guard.verdict('GET', url('/settings/allsettings'))).toBeUndefined();
    for (const method of ['POST', 'put', 'PATCH', 'DELETE']) {
      expect(guard.verdict(method, url('/settings/savesettings')), method).toBe('method');
    }
    expect(guard.verdict('POST', url('/reports/list'))).toBeUndefined();
    expect(guard.verdict('POST', url('/reports/list/extra'))).toBe('method');
    // Allowed by path only when the body is the expected read request.
    expect(guard.verdict('POST', url('/items/index'), 'draw=1&start=0&length=25')).toBeUndefined();
    expect(guard.verdict('POST', url('/items/index'), 'data[Item][name]=x')).toBe('method');
    expect(guard.verdict('POST', url('/items/index'))).toBe('method');
    expect(guard.verdict('GET', url('/users/logout'))).toBe('url');
    expect(guard.verdict('GET', url('/users/delete/12'))).toBe('url');
  });
});
