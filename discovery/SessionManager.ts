import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, BrowserType, Locator, Page } from '@playwright/test';
import type { DiscoveryConfig } from '../config/discoveryConfig';
import type { Logger } from './logger';

export type SessionSource = 'reused' | 'login-auto' | 'login-manual';
export type LoginMethod = 'auto' | 'manual';

export interface AuthenticatedSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** How the session was obtained. */
  source: SessionSource;
  /** Closes the context, and the browser too when it was launched by start(). */
  close(): Promise<void>;
}

/** The session ended: the app showed the login page where a logged-in page was expected. */
export class SessionExpiredError extends Error {
  constructor(where: string) {
    super(`Session expired: redirected to the login page while opening ${where}.`);
    this.name = 'SessionExpiredError';
  }
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginError';
  }
}

type AuthState = 'authenticated' | 'login-page' | 'mfa' | 'error' | 'pending';

const POLL_MS = 500;

/**
 * Opens a logged-in browser for discovery. Everything it needs (login route, selectors, MFA and
 * session settings, credentials, headless, timeouts) comes from the DiscoveryConfig built by
 * ConfigLoader.
 *
 * 1. Reuses the saved storageState when allowed, not older than maxAgeMinutes, and still logged in
 *    (checked by opening session.validationRoute). An expired one is deleted.
 * 2. Otherwise logs in:
 *    - auto: types BIZOM_USERNAME / BIZOM_PASSWORD; if an MFA prompt appears, a person completes it
 *      in the visible browser;
 *    - manual: a person logs in (and completes MFA) in the visible browser;
 *    - auto without credentials: falls back to manual when fallbackToManual is set and the browser
 *      is visible, otherwise stops with an error.
 * 3. Saves the new storageState (file mode 600).
 *
 * Credentials are typed with element.evaluate rather than locator.fill: Playwright titles fill steps
 * 'Fill "<value>"' in reports and traces, which would expose them.
 */
export class SessionManager {
  constructor(
    private readonly config: DiscoveryConfig,
    private readonly logger: Logger,
  ) {}

  private get auth() {
    return this.config.authentication;
  }

  /** Launches the browser (headless per config) and returns a logged-in session. */
  async start(browserType: BrowserType): Promise<AuthenticatedSession> {
    const browser = await browserType.launch({ headless: this.config.browser.headless });
    try {
      const session = await this.open(browser);
      return {
        ...session,
        close: async () => {
          await session.close();
          await browser.close();
        },
      };
    } catch (e) {
      await browser.close();
      throw e;
    }
  }

  /** A logged-in session in a new context of `browser`. */
  async open(browser: Browser): Promise<AuthenticatedSession> {
    const reused = await this.tryReuse(browser);
    if (reused) return reused;

    const method = this.loginMethod();
    const context = await this.newContext(browser);
    try {
      const page = await context.newPage();
      if (method === 'auto') await this.autoLogin(page);
      else await this.waitForManualLogin(page, 'Log in to the application in the opened browser window.');
      await this.saveState(context);
      this.logger.info(`Logged in (${method === 'auto' ? 'automated' : 'manual'}) as ${this.config.credentials.maskedUsername}.`);
      return this.session(browser, context, page, method === 'auto' ? 'login-auto' : 'login-manual');
    } catch (e) {
      await context.close();
      throw e;
    }
  }

  /**
   * Which login a fresh login would use. Missing credentials stop automated login; they never stop
   * manual login.
   */
  loginMethod(): LoginMethod {
    const { mode, fallbackToManual } = this.auth;
    const headless = this.config.browser.headless;
    if (mode === 'manual') {
      if (headless) throw new LoginError('Manual login needs a visible browser: set HEADLESS=false in .env.');
      return 'manual';
    }
    if (this.config.credentials.available) return 'auto';
    if (fallbackToManual && !headless) {
      this.logger.warn('BIZOM_USERNAME / BIZOM_PASSWORD not set: automated login skipped, falling back to manual login.');
      return 'manual';
    }
    throw new LoginError(
      'Automated login needs BIZOM_USERNAME and BIZOM_PASSWORD in .env. ' +
        (headless
          ? 'To log in manually instead, set HEADLESS=false.'
          : 'To log in manually instead, set authentication.fallbackToManual to true.'),
    );
  }

  /** True when `page` shows the logged-in application (not the login page). */
  async isAuthenticated(page: Page): Promise<boolean> {
    return (await this.authState(page)) === 'authenticated';
  }

  /** True when `page` shows the login page, i.e. the session has ended. */
  async isOnLoginPage(page: Page): Promise<boolean> {
    return (await this.authState(page)) === 'login-page';
  }

  /** Deletes the saved session so the next open() logs in again. */
  invalidate(reason: string) {
    const file = this.auth.session.storageStatePath;
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      this.logger.info(`Saved session deleted (${reason}).`);
    }
  }

  // --- reuse ----------------------------------------------------------------------------------

  private async tryReuse(browser: Browser): Promise<AuthenticatedSession | undefined> {
    const { reuseStorageState, storageStatePath, maxAgeMinutes, validationUrl } = this.auth.session;
    if (!reuseStorageState || !fs.existsSync(storageStatePath)) return undefined;

    const ageMinutes = (Date.now() - fs.statSync(storageStatePath).mtimeMs) / 60_000;
    if (ageMinutes > maxAgeMinutes) {
      this.invalidate(`older than ${maxAgeMinutes} minutes`);
      return undefined;
    }

    let context: BrowserContext;
    try {
      context = await this.newContext(browser, storageStatePath);
    } catch (e) {
      this.invalidate(`unreadable: ${(e as Error).message.split('\n')[0]}`);
      return undefined;
    }
    try {
      const page = await context.newPage();
      await page.goto(validationUrl, { waitUntil: this.config.discovery.navigation.waitUntil, timeout: this.config.discovery.navigation.timeoutMs });
      const state = await this.waitForAuthState(page, ['authenticated', 'login-page'], this.config.discovery.navigation.timeoutMs);
      if (state === 'authenticated') {
        this.logger.info(`Reusing saved session (${Math.round(ageMinutes)} min old).`);
        return this.session(browser, context, page, 'reused');
      }
      await context.close();
      this.invalidate(state === 'login-page' ? 'expired: the app showed the login page' : 'could not confirm it is logged in');
      return undefined;
    } catch (e) {
      await context.close();
      throw e;
    }
  }

  // --- login ----------------------------------------------------------------------------------

  private async autoLogin(page: Page) {
    const { selectors, loginTimeoutMs, loginUrl, loginRoute, mfa } = this.auth;
    const { username, password } = this.config.credentials;

    await page.goto(loginUrl, { waitUntil: this.config.discovery.navigation.waitUntil, timeout: loginTimeoutMs });
    await page.locator(selectors.usernameInput).waitFor({ state: 'visible', timeout: loginTimeoutMs });
    await setInputValue(page.locator(selectors.usernameInput), username);
    await setInputValue(page.locator(selectors.passwordInput), password);

    // Wait for the login POST to be answered before judging the page (the dev server can take
    // well over 5 seconds), but keep going if the app logs in some other way.
    const loginRequestPath = loginRoute.replace(/\/+$/, '');
    await Promise.all([
      page
        .waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith(loginRequestPath),
          { timeout: loginTimeoutMs },
        )
        .catch(() => undefined),
      page.locator(selectors.submitButton).click({ timeout: loginTimeoutMs }),
    ]);

    const state = await this.waitForAuthState(page, ['authenticated', 'mfa', 'error'], loginTimeoutMs);
    if (state === 'authenticated') return;
    if (state === 'error') {
      throw new LoginError(`Login was rejected by the application: "${await this.loginErrorText(page)}".`);
    }
    if (state === 'mfa') {
      if (!mfa.enabled) throw new LoginError('The application asked for a second factor (MFA), but authentication.mfa.enabled is false.');
      if (this.config.browser.headless) throw new LoginError('The application asked for a second factor (MFA): set HEADLESS=false to complete it.');
      await this.waitForManualLogin(page, 'Complete the second login step (MFA) in the opened browser window.', mfa.timeoutMs);
      return;
    }
    throw new LoginError(`Login did not complete within ${loginTimeoutMs} ms (LOGIN_TIMEOUT).`);
  }

  private async waitForManualLogin(page: Page, instruction: string, timeoutMs = this.auth.loginTimeoutMs) {
    if (this.config.browser.headless) throw new LoginError('Manual login needs a visible browser: set HEADLESS=false in .env.');
    if (!page.url().startsWith(this.config.baseUrl)) {
      await page.goto(this.auth.loginUrl, { waitUntil: this.config.discovery.navigation.waitUntil, timeout: timeoutMs });
    }
    this.logger.info(`${instruction} Waiting up to ${Math.round(timeoutMs / 1000)} s.`);
    const state = await this.waitForAuthState(page, ['authenticated'], timeoutMs);
    if (state !== 'authenticated') throw new LoginError(`Manual login was not completed within ${Math.round(timeoutMs / 1000)} s.`);
  }

  // --- state detection ------------------------------------------------------------------------

  /** Polls until the page reaches one of `wanted`, or the timeout passes ('pending'). */
  private async waitForAuthState(page: Page, wanted: AuthState[], timeoutMs: number): Promise<AuthState> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const state = await this.authState(page);
      if (wanted.includes(state)) return state;
      if (Date.now() >= deadline || page.isClosed()) return 'pending';
      await page.waitForTimeout(POLL_MS).catch(() => undefined);
    }
  }

  /** One look at the page; never waits. Navigations in progress count as 'pending'. */
  private async authState(page: Page): Promise<AuthState> {
    const { selectors, mfa } = this.auth;
    try {
      if (await page.locator(selectors.loggedInIndicator).count()) {
        return this.onLoginRoute(page) ? 'pending' : 'authenticated';
      }
      if (await page.locator(mfa.indicatorSelector).first().isVisible()) return 'mfa';
      for (const sel of selectors.loginErrorMessages) {
        if (await page.locator(sel).first().isVisible()) return 'error';
      }
      if (this.onLoginRoute(page) || (await page.locator(selectors.passwordInput).first().isVisible())) return 'login-page';
      return 'pending';
    } catch {
      return 'pending'; // e.g. "Execution context was destroyed" during a navigation
    }
  }

  private onLoginRoute(page: Page): boolean {
    try {
      const { pathname } = new URL(page.url());
      return pathname.replace(/\/+$/, '') === this.auth.loginRoute.replace(/\/+$/, '');
    } catch {
      return false;
    }
  }

  private async loginErrorText(page: Page): Promise<string> {
    for (const sel of this.auth.selectors.loginErrorMessages) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) return this.logger.redact((await el.innerText()).trim());
    }
    return 'unknown error';
  }

  // --- helpers --------------------------------------------------------------------------------

  private newContext(browser: Browser, storageState?: string) {
    return browser.newContext({
      baseURL: this.config.baseUrl,
      viewport: this.config.browser.viewport,
      ...(storageState ? { storageState } : {}),
    });
  }

  private async saveState(context: BrowserContext) {
    const { saveStorageState, storageStatePath } = this.auth.session;
    if (!saveStorageState) return;
    fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });
    fs.chmodSync(storageStatePath, 0o600);
    this.logger.info(`Session saved to ${path.relative(process.cwd(), storageStatePath)}.`);
  }

  private session(browser: Browser, context: BrowserContext, page: Page, source: SessionSource): AuthenticatedSession {
    return {
      browser,
      context,
      page,
      source,
      close: async () => {
        await context.close().catch(() => undefined);
      },
    };
  }
}

/**
 * Sets an input's value the way typing would (input + change events) without the value appearing
 * in Playwright step titles, reports or traces.
 */
async function setInputValue(input: Locator, value: string) {
  await input.evaluate((el, v) => {
    const field = el as HTMLInputElement;
    field.focus();
    field.value = v;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }, value);
}
