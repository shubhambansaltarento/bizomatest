import { sheetCasesFor } from '../data/userModuleCases';

/**
 * Links a test to the acceptance criteria it covers: tags it `@<ID>` (for --grep and
 * `npm run spec:check`) and adds a `spec` annotation pointing at the spec file.
 *
 * It also tags the test with the QA sheet cases of those criteria (`@TC8981`), taken from
 * data/userModuleCases.ts, so `npx playwright test --grep @TC8981` runs one sheet case and the
 * HTML report shows which sheet cases a test covers. Never write TC tags by hand: change the mapping.
 *
 *   test('AUTH-01 Valid user can log in', spec('auth/login-logout', 'AUTH-01'), async () => {});
 */
export function spec(specFile: string, ...ids: string[]) {
  const sheetCases = [...new Set(ids.flatMap(sheetCasesFor))];
  return {
    tag: [...ids, ...sheetCases].map((id) => `@${id}`),
    annotation: [
      ...ids.map((id) => ({ type: 'spec', description: `specs/${specFile}.md#${id.toLowerCase()}` })),
      ...(sheetCases.length ? [{ type: 'QA sheet', description: sheetCases.join(', ') }] : []),
    ],
  };
}
