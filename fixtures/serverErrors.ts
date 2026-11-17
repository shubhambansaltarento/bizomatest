import { expect, type Page } from '@playwright/test';

/**
 * Records every 5xx response a page gets, from the moment it is created. Tests get one watching
 * `authedPage` through the `serverErrors` fixture and check it with `expectNone()` wherever the
 * criterion says "without server errors".
 */
export class ServerErrors {
  private readonly seen: string[] = [];

  constructor(page: Page) {
    page.on('response', (r) => {
      if (r.status() >= 500) this.seen.push(`${r.status()} ${r.url()}`);
    });
  }

  /**
   * Fails if the page got a 5xx response so far. `ignore`: URLs a test breaks on purpose
   * (e.g. a request it routes to a 500).
   */
  expectNone({ ignore }: { ignore?: RegExp } = {}) {
    const errors = this.seen.filter((e) => !ignore?.test(e));
    expect(errors, 'server errors (5xx responses)').toEqual([]);
  }
}
