import fs from 'node:fs';
import path from 'node:path';
import type { Dialog, Page } from '@playwright/test';
import type { DiscoveryConfig, RouteConfig } from '../config/discoveryConfig';
import type { Logger } from './logger';
import type { DiscoveryModuleRegistry } from './modules/DiscoveryModule';
import { ProgressStore } from './ProgressStore';
import { ReadOnlyGuard, type BlockedRequest } from './ReadOnlyGuard';
import { SessionExpiredError, type SessionManager } from './SessionManager';

/**
 * - navigate: open every enabled route and check it loads logged in, without an error page
 *   (no discovery module is called; resume is not used).
 * - discover: also run the route's discovery module and store what it returns (resume applies).
 */
export type RunMode = 'navigate' | 'discover';

export type SkipReason = 'disabled' | 'completed' | 'limit' | 'aborted';

export interface RoutePlan {
  toRun: RouteConfig[];
  skipped: { route: RouteConfig; reason: SkipReason }[];
}

export interface RouteResult {
  routeId: string;
  name: string;
  discoveryType: string;
  /** The configured path, and the path the browser ended on (they differ after a redirect). */
  path: string;
  finalPath: string;
  status: 'passed' | 'failed';
  httpStatus: number | null;
  title: string;
  attempts: number;
  durationMs: number;
  blockedRequests: BlockedRequest[];
  dialogs: string[];
  /** Text of the app's flash banners shown on the page (not counted as errors). */
  appMessages: string[];
  screenshot?: string;
  snapshot?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface RunReport {
  runId: string;
  mode: RunMode;
  application: string;
  environment: string;
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  results: RouteResult[];
  skipped: { routeId: string; reason: SkipReason }[];
  /** Why the run stopped early, if it did (e.g. the session expired). */
  aborted?: string;
  reportFile: string;
}

/**
 * Runs discovery over the routes configured in discovery-config.json. It only ever navigates to
 * BIZOM_BASE_URL + a configured route path, with read-only mode enforced on the browser context,
 * and hands each page to the module registered for the route's discoveryType.
 */
export class RouteDiscoveryEngine {
  constructor(
    private readonly config: DiscoveryConfig,
    private readonly modules: DiscoveryModuleRegistry,
    private readonly sessions: SessionManager,
    private readonly logger: Logger,
  ) {}

  /** Which routes a run would visit, and why the others are skipped. Opens no browser. */
  plan(mode: RunMode): RoutePlan {
    const { routes, limits } = this.config.discovery;
    const progress = this.progressFor(mode);
    const plan: RoutePlan = { toRun: [], skipped: [] };
    for (const route of routes) {
      if (!route.enabled) plan.skipped.push({ route, reason: 'disabled' });
      else if (progress?.isCompleted(route.id)) plan.skipped.push({ route, reason: 'completed' });
      else if (plan.toRun.length >= limits.maxRoutesPerRun) plan.skipped.push({ route, reason: 'limit' });
      else plan.toRun.push(route);
    }
    return plan;
  }

  async run(page: Page, { mode }: { mode: RunMode }): Promise<RunReport> {
    if (this.config.readOnly.enabled !== true) throw new Error('Read-only mode is disabled; discovery refuses to run.');
    if (!this.config.discovery.routes.some((r) => r.enabled)) {
      throw new Error('No enabled routes in discovery.routes (config/discovery-config.json): nothing to run.');
    }

    const plan = this.plan(mode);
    if (mode === 'discover') {
      const missing = [...new Set(plan.toRun.map((r) => r.discoveryType))].filter((t) => !this.modules.get(t));
      if (missing.length) {
        throw new Error(
          `No discovery module registered for type(s) ${missing.join(', ')}. ` +
            `Register one, or disable the routes that use it in discovery-config.json.`,
        );
      }
    }

    const startedAt = new Date();
    const runId = startedAt.toISOString().replace(/[:.]/g, '-');
    const deadline = startedAt.getTime() + this.config.discovery.limits.runTimeoutMs;
    const progress = this.progressFor(mode);
    const results: RouteResult[] = [];
    const skipped = plan.skipped.map(({ route, reason }) => ({ routeId: route.id, reason }));
    let aborted: string | undefined;

    for (const s of plan.skipped) {
      this.logger.info(`Skipping ${s.route.id} (${s.route.path}): ${s.reason}.`);
    }

    const guard = new ReadOnlyGuard(this.config, this.logger);
    await guard.install(page.context());
    const dialogs: string[] = [];
    const onDialog = (d: Dialog) => {
      dialogs.push(this.logger.redact(d.message()));
      d.dismiss().catch(() => undefined);
    };
    page.on('dialog', onDialog);

    try {
      for (const [i, route] of plan.toRun.entries()) {
        if (aborted) {
          skipped.push({ routeId: route.id, reason: 'aborted' });
          continue;
        }
        if (Date.now() > deadline) {
          aborted = `discovery.limits.runTimeoutMs (${this.config.discovery.limits.runTimeoutMs} ms) reached`;
          skipped.push({ routeId: route.id, reason: 'aborted' });
          continue;
        }
        if (i > 0 && this.config.discovery.limits.delayBetweenRoutesMs) {
          await page.waitForTimeout(this.config.discovery.limits.delayBetweenRoutesMs);
        }

        const result = await this.runRoute(page, route, mode, runId, guard, dialogs);
        results.push(result);
        if (result.status === 'failed' && result.error?.startsWith('Session expired')) {
          aborted = result.error;
          this.sessions.invalidate('expired during discovery');
        }
        if (progress) {
          progress.record(route.id, {
            status: result.status,
            finishedAt: new Date().toISOString(),
            ...(result.error ? { error: result.error } : {}),
          });
        }
      }
    } finally {
      page.off('dialog', onDialog);
      await guard.uninstall();
    }

    const report: RunReport = {
      runId,
      mode,
      application: this.config.application.name,
      environment: this.config.application.environment,
      baseUrl: this.config.baseUrl,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      results,
      skipped,
      ...(aborted ? { aborted } : {}),
      reportFile: path.join(this.config.output.reportsDir, `${runId}-${mode}.json`),
    };
    this.writeJson(report.reportFile, report);

    const passed = results.filter((r) => r.status === 'passed').length;
    this.logger.info(
      `Run ${runId} (${mode}): ${passed}/${results.length} routes passed, ${skipped.length} skipped` +
        `${aborted ? `, stopped early: ${aborted}` : ''}. Report: ${path.relative(process.cwd(), report.reportFile)}`,
    );
    return report;
  }

  private progressFor(mode: RunMode): ProgressStore | undefined {
    const { enabled, skipCompleted } = this.config.resume;
    return mode === 'discover' && enabled && skipCompleted ? new ProgressStore(this.config.output.stateDir, mode) : undefined;
  }

  private async runRoute(
    page: Page,
    route: RouteConfig,
    mode: RunMode,
    runId: string,
    guard: ReadOnlyGuard,
    dialogs: string[],
  ): Promise<RouteResult> {
    const started = Date.now();
    const blockedFrom = guard.blocked.length;
    const dialogsFrom = dialogs.length;
    const maxAttempts = 1 + this.config.discovery.limits.maxRetriesPerRoute;
    this.logger.info(`Opening ${route.id}: ${route.path}`);

    let attempts = 0;
    let httpStatus: number | null = null;
    let appMessages: string[] = [];
    let data: Record<string, unknown> | undefined;
    let error: string | undefined;

    while (attempts < maxAttempts) {
      attempts++;
      error = undefined;
      const attemptBlockedFrom = guard.blocked.length;
      try {
        ({ httpStatus, appMessages } = await this.navigate(page, route, () => guard.blockedSince(attemptBlockedFrom)));
        if (mode === 'discover') {
          const module = this.modules.get(route.discoveryType)!;
          data = await module.discover({ page, route, config: this.config, logger: this.logger });
        }
        break;
      } catch (e) {
        error = this.logger.redact((e as Error).message.split('\n')[0]);
        if (e instanceof SessionExpiredError) break; // retrying cannot help
        this.logger.warn(`${route.id}: attempt ${attempts}/${maxAttempts} failed: ${error}`);
      }
    }

    const status = error ? 'failed' : 'passed';
    const result: RouteResult = {
      routeId: route.id,
      name: route.name,
      discoveryType: route.discoveryType,
      path: route.path,
      finalPath: safePath(page.url()),
      status,
      httpStatus,
      title: await page.title().catch(() => ''),
      attempts,
      durationMs: Date.now() - started,
      blockedRequests: guard.blockedSince(blockedFrom),
      dialogs: dialogs.slice(dialogsFrom),
      appMessages,
      ...(data ? { data } : {}),
      ...(error ? { error } : {}),
    };

    const { screenshots, snapshot, output } = this.config;
    if (screenshots.enabled || (status === 'failed' && screenshots.onFailure)) {
      const file = path.join(output.screenshotsDir, runId, `${route.id}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page
        .screenshot({ path: file, fullPage: route.fullPageScreenshot ?? screenshots.fullPage })
        .then(() => (result.screenshot = file))
        .catch((e: Error) => this.logger.warn(`${route.id}: screenshot failed: ${e.message.split('\n')[0]}`));
    }
    if (snapshot.enabled) {
      result.snapshot = path.join(output.snapshotsDir, runId, `${route.id}.json`);
      const html = snapshot.includeHtml ? { html: await page.content().catch(() => '') } : {};
      this.writeJson(result.snapshot, { ...result, capturedAt: new Date().toISOString(), ...html });
    }

    const extra =
      (result.blockedRequests.length ? `, ${result.blockedRequests.length} request(s) blocked by read-only mode` : '') +
      (appMessages.length ? `, app message: ${appMessages.map((m) => `"${m}"`).join(', ')}` : '');
    if (status === 'passed') this.logger.info(`${route.id}: OK (${result.finalPath}, "${result.title}")${extra}`);
    else this.logger.error(`${route.id}: FAILED: ${error}${extra}`);
    return result;
  }

  /**
   * Opens BIZOM_BASE_URL + route.path and checks the page is a logged-in page whose data has loaded,
   * without an error: network idle, then route.readySelector, then no loading indicator.
   */
  private async navigate(
    page: Page,
    route: RouteConfig,
    blockedDuringLoad: () => BlockedRequest[],
  ): Promise<{ httpStatus: number | null; appMessages: string[] }> {
    const { waitUntil, timeoutMs, networkIdleTimeoutMs, failOnBlockedRequests, flashMessageSelectors, errorTextPatterns } =
      this.config.discovery.navigation;
    const response = await page.goto(route.url, { waitUntil, timeout: timeoutMs });
    const httpStatus = response?.status() ?? null;

    if (await this.sessions.isOnLoginPage(page)) throw new SessionExpiredError(route.path);
    if (httpStatus !== null && httpStatus >= 400) throw new Error(`HTTP ${httpStatus} for ${route.path}`);

    // Most Bizom pages load their data by XHR after the load event.
    if (networkIdleTimeoutMs) {
      await page
        .waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs })
        .catch(() => this.logger.info(`${route.id}: network still busy after ${networkIdleTimeoutMs} ms; checking the page anyway.`));
    }

    // A blocked request means the page could not load all its data; say so instead of timing out below.
    const blocked = blockedDuringLoad();
    if (failOnBlockedRequests && blocked.length) {
      throw new Error(
        `read-only mode blocked ${blocked.map((b) => `${b.method} ${b.path}`).join(', ')} while ${route.path} loaded, so the page is incomplete. ` +
          'If the request only reads data, add it to readOnly.allowedRequests.',
      );
    }

    if (route.readySelector) {
      await page
        .locator(route.readySelector)
        .first()
        .waitFor({ state: route.readyState, timeout: timeoutMs })
        .catch(() => {
          throw new Error(`${route.path}: readySelector "${route.readySelector}" not ${route.readyState} after ${timeoutMs} ms; the page's data did not load.`);
        });
    }
    await this.waitForLoadingToFinish(page, route, timeoutMs);

    if (!(await this.sessions.isAuthenticated(page))) {
      throw new Error(`${route.path} did not show the logged-in application (authentication.selectors.loggedInIndicator not found).`);
    }
    // Flash banners can carry a message left in the session by an earlier request: record them, and
    // look for error texts in the rest of the page only.
    const appMessages: string[] = [];
    for (const sel of flashMessageSelectors) {
      for (const el of await page.locator(sel).all()) {
        if (!(await el.isVisible().catch(() => false))) continue;
        const text = (await el.innerText().catch(() => '')).replace(/×/g, '').replace(/\s+/g, ' ').trim();
        if (text) appMessages.push(this.logger.redact(text));
      }
    }
    let body = (await page.locator('body').innerText({ timeout: timeoutMs })).replace(/\s+/g, ' ');
    for (const m of appMessages) body = body.split(m).join(' ');
    const hit = errorTextPatterns.find((re) => re.test(body));
    if (hit) throw new Error(`${route.path} shows an error page (matched /${hit.source}/).`);
    return { httpStatus, appMessages };
  }

  /** Waits until no discovery.navigation.loadingSelectors element is visible. */
  private async waitForLoadingToFinish(page: Page, route: RouteConfig, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const showing: string[] = [];
      for (const sel of this.config.discovery.navigation.loadingSelectors) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) showing.push(sel);
      }
      if (!showing.length) return;
      if (Date.now() >= deadline) {
        throw new Error(`${route.path} still shows a loading indicator (${showing.join(', ')}) after ${timeoutMs} ms.`);
      }
      await page.waitForTimeout(500);
    }
  }

  private writeJson(file: string, value: unknown) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.logger.redact(JSON.stringify(value, null, 2)));
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
