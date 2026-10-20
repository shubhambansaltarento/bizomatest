// Checks that every acceptance criterion in specs/ has a test tagged with its ID,
// and that every test tag points at a criterion that exists.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, ext);
    return e.name.endsWith(ext) && !e.name.startsWith('_') ? [full] : [];
  });
}

const rel = (f) => path.relative(root, f);

const criteria = new Map(); // id -> spec file
for (const file of walk(path.join(root, 'specs'), '.md')) {
  for (const [, id] of fs.readFileSync(file, 'utf8').matchAll(/^###\s+([A-Z]+-\d+)\b/gm)) {
    criteria.set(id, rel(file));
  }
}

const tagged = new Map(); // id -> test files
for (const file of walk(path.join(root, 'tests'), '.spec.ts')) {
  const src = fs.readFileSync(file, 'utf8');
  // IDs appear as quoted strings, e.g. spec('auth/login-logout', 'AUTH-01') or tag: '@AUTH-01'.
  const ids = new Set([...src.matchAll(/['"`]@?([A-Z]+-\d+)['"`]/g)].map((m) => m[1]));
  for (const id of ids) tagged.set(id, [...(tagged.get(id) ?? []), rel(file)]);
}

const missing = [...criteria].filter(([id]) => !tagged.has(id));
const orphans = [...tagged].filter(([id]) => !criteria.has(id));

console.log(`Spec coverage: ${criteria.size - missing.length}/${criteria.size} criteria have tests.`);
for (const [id, file] of missing) console.log(`  MISSING TEST  ${id}  (${file})`);
for (const [id, files] of orphans) console.log(`  UNKNOWN ID    ${id}  (${files.join(', ')})`);

process.exit(missing.length || orphans.length ? 1 : 0);
