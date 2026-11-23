import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../../config/ConfigLoader';
import { createLogger, type Logger } from '../../discovery/logger';
import { DiscoveryModuleRegistry } from '../../discovery/modules/DiscoveryModule';
import { RouteDiscoveryEngine } from '../../discovery/RouteDiscoveryEngine';
import { SessionManager } from '../../discovery/SessionManager';
import { spec } from '../../fixtures/spec';

/*
 * Logs in to the application at BIZOM_BASE_URL and opens every enabled route of
 * config/discovery-config.json, read-only. Base URL, credentials, routes, selectors, timeouts and
 * output folders all come from ConfigLoader; this file holds none of them.
 */

const SPEC = 'discovery/config-auth-navigation';

// Startup validation: a bad .env or discovery-config.json stops the run here with the full list of problems.
const config = ConfigLoader.get();

/** Logger that prints as usual and also keeps every line, to check for credentials (DISC-09). */
function capturingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger = createLogger(config, (level, line) => {
    lines.push(line);
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
  });
  for (const w of config.warnings) logger.warn(w);
  return { logger, lines };
}

test.describe('discovery authentication and navigation', () => {
  test.describe.configure({ mode: 'serial', timeout: config.discovery.limits.runTimeoutMs });

  test(
    'DISC-06 Login saves a reusable session; DISC-07 a saved session is reused, an expired one is replaced',
    spec(SPEC, 'DISC-06', 'DISC-07'),
    async ({ playwright }) => {
      const { logger, lines } = capturingLogger();
      const sessions = new SessionManager(config, logger);
      const stateFile = config.authentication.session.storageStatePath;
      test.skip(!config.authentication.session.saveStorageState || !config.authentication.session.reuseStorageState,
        'Session saving / reuse is switched off in discovery-config.json.');

      await test.step('DISC-06 fresh login saves the session', async () => {
        sessions.invalidate('test starts from no saved session');
        const session = await sessions.start(playwright.chromium);
        try {
          expect(session.source).toMatch(/^login-(auto|manual)$/);
          expect(await sessions.isAuthenticated(session.page)).toBe(true);
          expect(fs.existsSync(stateFile)).toBe(true);
          expect(fs.statSync(stateFile).mode & 0o777).toBe(0o600);
        } finally {
          await session.close();
        }
      });

      await test.step('DISC-07 the saved session is reused', async () => {
        const session = await sessions.start(playwright.chromium);
        try {
          expect(session.source).toBe('reused');
          expect(await sessions.isAuthenticated(session.page)).toBe(true);
        } finally {
          await session.close();
        }
      });

      await test.step('DISC-07 a session the app no longer accepts is detected and replaced', async () => {
        // Drop the cookies: the app then shows the login page, as it does for an expired session.
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        fs.writeFileSync(stateFile, JSON.stringify({ ...state, cookies: [] }));
        const session = await sessions.start(playwright.chromium);
        try {
          expect(lines.join('\n')).toContain('expired: the app showed the login page');
          expect(session.source).toMatch(/^login-(auto|manual)$/);
          expect(await sessions.isAuthenticated(session.page)).toBe(true);
        } finally {
          await session.close();
        }
      });

      await test.step('DISC-07 a session older than maxAgeMinutes is replaced', async () => {
        const old = new Date(Date.now() - (config.authentication.session.maxAgeMinutes + 1) * 60_000);
        fs.utimesSync(stateFile, old, old);
        const session = await sessions.start(playwright.chromium);
        try {
          expect(lines.join('\n')).toContain(`older than ${config.authentication.session.maxAgeMinutes} minutes`);
          expect(session.source).toMatch(/^login-(auto|manual)$/);
        } finally {
          await session.close();
        }
      });
    },
  );

  test(
    'DISC-08 Every enabled route opens logged in, read-only; DISC-09 credentials never appear in logs or output',
    spec(SPEC, 'DISC-08', 'DISC-09'),
    async ({ playwright }) => {
      const { logger, lines } = capturingLogger();
      const sessions = new SessionManager(config, logger);
      const engine = new RouteDiscoveryEngine(config, new DiscoveryModuleRegistry(), sessions, logger);
      const enabled = config.discovery.routes.filter((r) => r.enabled);
      const disabled = config.discovery.routes.filter((r) => !r.enabled);

      const session = await sessions.start(playwright.chromium);
      const report = await test.step('DISC-08 navigation run', async () => {
        try {
          return await engine.run(session.page, { mode: 'navigate' });
        } finally {
          await session.close();
        }
      });

      await test.step('DISC-08 exactly the enabled routes were opened, each without error', async () => {
        expect(report.aborted, report.aborted).toBeUndefined();
        expect(report.results.map((r) => r.routeId)).toEqual(enabled.slice(0, config.discovery.limits.maxRoutesPerRun).map((r) => r.id));
        for (const d of disabled) expect(report.skipped).toContainEqual({ routeId: d.id, reason: 'disabled' });
        for (const r of report.results) {
          expect.soft(r.status, `${r.routeId} (${r.path}): ${r.error ?? ''}`).toBe('passed');
          if (r.finalPath !== r.path) logger.warn(`${r.routeId}: ${r.path} redirected to ${r.finalPath}`);
        }
        expect(fs.existsSync(report.reportFile)).toBe(true);
        for (const r of report.results) {
          if (config.snapshot.enabled) expect.soft(r.snapshot && fs.existsSync(r.snapshot), `${r.routeId} snapshot`).toBeTruthy();
          if (config.screenshots.enabled) expect.soft(r.screenshot && fs.existsSync(r.screenshot), `${r.routeId} screenshot`).toBeTruthy();
        }
      });

      await test.step('DISC-09 no credential in log lines, report or snapshots', async () => {
        const written = [report.reportFile, ...report.results.flatMap((r) => (r.snapshot ? [r.snapshot] : []))].map((f) => ({
          name: path.relative(config.output.rootDir, f),
          text: fs.readFileSync(f, 'utf8'),
        }));
        const sources = [{ name: 'log', text: lines.join('\n') }, ...written];
        for (const [i, secret] of config.credentials.secrets().entries()) {
          for (const s of sources) {
            // Never print the secret itself in the failure message.
            expect.soft(s.text.includes(secret), `credential #${i + 1} found in ${s.name}`).toBe(false);
          }
        }
      });
    },
  );
});
