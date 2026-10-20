/**
 * Links a test to the acceptance criteria it covers: tags it `@<ID>` (for --grep and
 * `npm run spec:check`) and adds a `spec` annotation pointing at the spec file.
 *
 *   test('AUTH-01 Valid user can log in', spec('auth/login-logout', 'AUTH-01'), async () => {});
 */
export function spec(specFile: string, ...ids: string[]) {
  return {
    tag: ids.map((id) => `@${id}`),
    annotation: ids.map((id) => ({ type: 'spec', description: `specs/${specFile}.md#${id.toLowerCase()}` })),
  };
}
