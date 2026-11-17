// User module coverage: maps the QA sheet to the code and writes
// docs/user-module/user-module-test-coverage.xlsx.
//
// Sources (nothing is typed into the Excel by hand):
// - QA sheet:   docs/TestCases_11-11-26-07_45_22.csv (title, steps, expected result, priority, ...)
// - Mapping:    data/userModuleCases.ts (sheet case → criterion IDs, or why it has no test)
// - Specs:      specs/**.md (`### <ID> <title>`, and `Sheet: TC…` lines)
// - Code:       the real test list (`playwright test --list`), and each test's source for
//               test.fail (known app bug), test.fixme (blocker) and test.skip (may skip)
//
// It checks that the links hold (every sheet case mapped once, every criterion has a spec and a test,
// every test of a covered case carries its @TC tag, spec `Sheet:` lines agree with the mapping) and
// exits 1 when one doesn't. The Excel is written either way; its "Checks" tab lists the problems.
//
// Run: npm run coverage:users
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import ExcelJS from 'exceljs';

const root = path.resolve(import.meta.dirname, '..');
const SHEET_CSV = 'docs/TestCases_11-11-26-07_45_22.csv';
const MAPPING = 'data/userModuleCases.ts';
const OUT = 'docs/user-module/user-module-test-coverage.xlsx';
/** Spec folders of the user module; their criteria are listed even when no sheet case uses them. */
const MODULE_SPEC_DIRS = ['specs/users', 'specs/user-creation', 'specs/user-block'];

const STATUSES = ['Covered', 'Partial', 'TODO', 'Blocker', 'Not covered'];
const STATUS_HELP = {
  Covered: 'Every linked criterion has a test in the code. A test marked test.fail (known app bug) still counts: see "Known app bug".',
  Partial: 'Tested, but part of the sheet case is not (see "Remaining" and "Reason / what is left").',
  TODO: 'Can be automated on devarun; no test yet.',
  Blocker: 'Cannot be automated now (environment, setting, unclear steps). Includes tests marked test.fixme.',
  'Not covered': 'Out of scope for the web suite: API, mobile app, or another module.',
};

const problems = []; // { level: 'Error' | 'Warning', check, detail }
const error = (check, detail) => problems.push({ level: 'Error', check, detail });
const warn = (check, detail) => problems.push({ level: 'Warning', check, detail });
const rel = (f) => path.relative(root, f).split(path.sep).join('/');

// ───────────────────────── QA sheet ─────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((v) => v.trim()));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const plain = (s) =>
  (s ?? '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/﻿/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

const sheetRows = parseCsv(fs.readFileSync(path.join(root, SHEET_CSV), 'utf8'));
const sheet = new Map(sheetRows.map((r, i) => [r['Case code'], { ...r, row: i + 1 }]));

// ───────────────────────── Mapping ─────────────────────────
const mappingJs = stripTypeScriptTypes(fs.readFileSync(path.join(root, MAPPING), 'utf8'));
const { userModuleCases } = await import(`data:text/javascript;base64,${Buffer.from(mappingJs).toString('base64')}`);

// ───────────────────────── Specs ─────────────────────────
function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, ext);
    return e.name.endsWith(ext) && !e.name.startsWith('_') ? [full] : [];
  });
}

/** `TC10599–TC10605` → every code in between, `TC8997, TC8991` → both. */
function expandCodes(text) {
  const codes = new Set();
  for (const [, a, b] of text.matchAll(/TC(\d+)\s*[–-]\s*TC(\d+)/g)) for (let n = +a; n <= +b; n++) codes.add(`TC${n}`);
  for (const [code] of text.matchAll(/TC\d+/g)) codes.add(code);
  return codes;
}

const criteria = new Map(); // id → { id, title, spec, sheetLine: Set<TC> }
for (const file of walk(path.join(root, 'specs'), '.md')) {
  const text = fs.readFileSync(file, 'utf8');
  const parts = text.split(/^(?=###\s)/m);
  for (const part of parts) {
    const m = part.match(/^###\s+([A-Z]+-\d+)\s+(.*)/);
    if (!m) continue;
    const sheetLine = new Set();
    for (const [, line] of part.matchAll(/^Sheet:\s*(.*)$/gm)) for (const c of expandCodes(line.split('(')[0])) sheetLine.add(c);
    criteria.set(m[1], { id: m[1], title: m[2].trim(), spec: rel(file), sheetLine });
  }
}

// ───────────────────────── Code: real test list ─────────────────────────
function listTests() {
  const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
  const out = execFileSync(bin, ['test', '--list', '--reporter=json'], {
    cwd: root,
    // Include the config and user-block projects, which only exist when these are set.
    env: { ...process.env, E2E_CONFIG: '1', E2E_USER_BLOCK: '1' },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
  const report = JSON.parse(out.slice(out.indexOf('{')));
  const testDir = report.config?.rootDir ?? path.join(root, 'tests');
  const tests = [];
  const visit = (suite) => {
    for (const s of suite.specs ?? []) {
      tests.push({
        file: rel(path.join(testDir, s.file)),
        line: s.line,
        title: s.title,
        tags: (s.tags ?? []).map((t) => t.replace(/^@/, '')),
        projects: [...new Set((s.tests ?? []).map((t) => t.projectName))],
      });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const s of report.suites ?? []) visit(s);
  for (const e of report.errors ?? []) error('Test list loads', plain(e.message ?? String(e)).split('\n')[0]);
  return tests;
}

const tests = listTests();

/** Source of each test: from its line to the next test's line in the same file. */
const sourceCache = new Map();
function testSource(t) {
  if (!sourceCache.has(t.file)) sourceCache.set(t.file, fs.readFileSync(path.join(root, t.file), 'utf8').split('\n'));
  const lines = sourceCache.get(t.file);
  const next = Math.min(...tests.filter((o) => o.file === t.file && o.line > t.line).map((o) => o.line), lines.length + 1);
  return lines.slice(t.line - 1, next - 1).join('\n');
}

/** First string literal after `test.<kind>(<condition>,`. */
function markers(src, kind) {
  const found = [];
  const re = new RegExp(`(^.*?)test\\.${kind}\\(\\s*([^,]*?)\\s*,\\s*(?:[\\w.]+\\()?\\s*(['"\`])((?:\\\\.|(?!\\3)[\\s\\S])*?)\\3`, 'gm');
  for (const m of src.matchAll(re)) {
    const conditional = /\bif\s*\(/.test(m[1]) || m[2].trim() !== 'true';
    found.push({ conditional, reason: m[4].replace(/\s+/g, ' ').trim(), condition: m[2].trim() });
  }
  // Reasons held in a variable (e.g. test.fail(true, webLogin.issue)).
  for (const m of src.matchAll(new RegExp(`(^.*?)test\\.${kind}\\(\\s*([^,]*?)\\s*,\\s*([\\w.]+)\\s*\\)`, 'gm'))) {
    const conditional = /\bif\s*\(/.test(m[1]) || m[2].trim() !== 'true';
    found.push({ conditional, reason: `Only for some data rows; the reason is in the test data (\`${m[3]}\`).`, condition: m[2].trim() });
  }
  return found;
}

for (const t of tests) {
  const src = testSource(t);
  t.fail = markers(src, 'fail');
  t.fixme = markers(src, 'fixme');
  t.skip = markers(src, 'skip');
}

const testsById = new Map(); // tag → tests
for (const t of tests) for (const tag of t.tags) testsById.set(tag, [...(testsById.get(tag) ?? []), t]);

function runCommand(t, grep) {
  if (t.projects.includes('config')) return `npm run test:config -- --grep @${grep}`;
  if (t.projects.includes('user-block')) return `npm run test:user-block -- --grep @${grep}`;
  return `npx playwright test --grep @${grep}`;
}

/** One line per test location; tests generated in a loop share a line. */
function describeTests(list) {
  const byLoc = new Map();
  for (const t of list) byLoc.set(`${t.file}:${t.line}`, [...(byLoc.get(`${t.file}:${t.line}`) ?? []), t]);
  return [...byLoc].map(([loc, ts]) => `${loc}  ${ts[0].title}${ts.length > 1 ? `  (+${ts.length - 1} more, one per data row)` : ''}`);
}

// ───────────────────────── Checks: mapping ↔ sheet ─────────────────────────
const seen = new Map();
for (const c of userModuleCases) {
  if (seen.has(c.tc)) error('Each sheet case is mapped once', `${c.tc} is listed ${seen.get(c.tc) + 1} times in ${MAPPING}`);
  seen.set(c.tc, (seen.get(c.tc) ?? 0) + 1);
  if (!sheet.has(c.tc)) error('Mapped cases exist in the sheet', `${c.tc} is in ${MAPPING} but not in ${SHEET_CSV}`);
  const kinds = ['coveredBy', 'todo', 'blocker', 'notCovered'].filter((k) => k in c);
  if (kinds.length !== 1) error('Each case has one outcome', `${c.tc} has ${kinds.length ? kinds.join(' + ') : 'none of coveredBy / todo / blocker / notCovered'}`);
  if ('coveredBy' in c && !c.coveredBy.length) error('Each case has one outcome', `${c.tc}: coveredBy is empty`);
}
for (const tc of sheet.keys()) if (!seen.has(tc)) error('Every sheet case is mapped', `${tc} (${plain(sheet.get(tc).Title).slice(0, 80)}) is missing from ${MAPPING}`);

// ───────────────────────── Rows ─────────────────────────
const rows = userModuleCases.map((c) => {
  const s = sheet.get(c.tc) ?? {};
  const linked = c.coveredBy ?? [];
  const linkedTests = [];
  for (const id of linked) {
    if (!criteria.has(id)) error('Linked criteria exist in a spec', `${c.tc} → ${id}: no "### ${id}" in specs/`);
    const ts = testsById.get(id) ?? [];
    if (!ts.length) error('Linked criteria have a test', `${c.tc} → ${id}: no test tagged @${id} in tests/`);
    linkedTests.push(...ts);
  }
  const uniqueTests = [...new Set(linkedTests)];
  if (linked.length && uniqueTests.length && !uniqueTests.some((t) => t.tags.includes(c.tc))) {
    error('Tests carry their sheet case tag', `${c.tc}: tests of ${linked.join(', ')} are not tagged @${c.tc} (use spec() from fixtures/spec.ts)`);
  }

  const fixmes = uniqueTests.flatMap((t) => t.fixme.filter((m) => !m.conditional));
  const fails = uniqueTests.flatMap((t) => t.fail);
  const skips = uniqueTests.flatMap((t) => t.skip.filter((m) => m.conditional));

  let status, remaining = '', reason = '';
  if ('notCovered' in c) { status = 'Not covered'; reason = c.notCovered; }
  else if ('blocker' in c) { status = 'Blocker'; reason = c.blocker; }
  else if ('todo' in c) { status = 'TODO'; reason = c.todo; }
  else if (fixmes.length) { status = 'Blocker'; reason = `Test is a placeholder (test.fixme): ${fixmes[0].reason}`; }
  else if (c.gap) { status = 'Partial'; remaining = c.gap.remaining; reason = c.gap.note; }
  else status = 'Covered';

  const always = fails.filter((f) => !f.conditional);
  const knownBug = always.length ? 'Yes' : fails.length ? 'Some runs' : '';
  const bugReason = [...new Set(fails.map((f) => f.reason))].join('\n');
  const testNotes = [...new Set(skips.map((m) => `May skip: ${m.reason}`))].join('\n');

  return {
    tc: c.tc,
    sheetTitle: plain(s.Title),
    about: c.about,
    area: c.area,
    status,
    remaining,
    reason,
    knownBug,
    bugReason,
    coveredBy: linked.join(', '),
    specs: [...new Set(linked.map((id) => criteria.get(id)?.spec).filter(Boolean))].join('\n'),
    tests: describeTests(uniqueTests).join('\n'),
    testNotes,
    run: linked.length ? [...new Set(uniqueTests.map((t) => runCommand(t, c.tc)))].join('\n') : '',
    mismatch: c.mismatch ?? '',
    client: c.client ?? '',
    setting: c.setting ?? '',
    priority: s.Priorities ?? '',
    type: s.Type ?? '',
    tags: [s.Tags, s['New Tags']].filter(Boolean).join(', '),
    precondition: plain(s.Precondition),
    steps: plain(s.Steps),
    expected: plain(s.ExpectedResult),
    sheetRow: s.row ?? '',
  };
});
const sheetOrder = new Map([...sheet.keys()].map((tc, i) => [tc, i]));
rows.sort((a, b) => (sheetOrder.get(a.tc) ?? 1e9) - (sheetOrder.get(b.tc) ?? 1e9));

// ───────────────────────── Checks: specs' Sheet lines ↔ mapping ─────────────────────────
const mapped = new Map(userModuleCases.map((c) => [c.tc, c]));
for (const cr of criteria.values()) {
  for (const tc of cr.sheetLine) {
    const c = mapped.get(tc);
    if (!c) continue; // other sheets (e.g. login) use "Sheet row N"
    if (!(c.coveredBy ?? []).includes(cr.id)) {
      error('Spec "Sheet:" lines agree with the mapping', `${cr.spec} ${cr.id} says "Sheet: ${tc}", but ${MAPPING} does not link ${tc} to ${cr.id}`);
    }
  }
}

// ───────────────────────── Code → Sheet (criteria) ─────────────────────────
const moduleIds = new Set([
  ...[...criteria.values()].filter((cr) => MODULE_SPEC_DIRS.some((d) => cr.spec.startsWith(`${d}/`))).map((cr) => cr.id),
  ...userModuleCases.flatMap((c) => c.coveredBy ?? []),
]);
const criteriaRows = [...moduleIds]
  .filter((id) => criteria.has(id))
  .sort((a, b) => criteria.get(a).spec.localeCompare(criteria.get(b).spec) || a.localeCompare(b, undefined, { numeric: true }))
  .map((id) => {
    const cr = criteria.get(id);
    const ts = testsById.get(id) ?? [];
    const tcs = userModuleCases.filter((c) => (c.coveredBy ?? []).includes(id)).map((c) => c.tc);
    const fixme = ts.some((t) => t.fixme.some((m) => !m.conditional));
    const fail = ts.flatMap((t) => t.fail);
    const state = !ts.length ? 'No test' : fixme ? 'Placeholder (fixme)' : fail.some((f) => !f.conditional) ? 'Known app bug (test.fail)' : fail.length ? 'Known app bug in some runs' : 'Test in place';
    if (!ts.length && MODULE_SPEC_DIRS.some((d) => cr.spec.startsWith(`${d}/`))) warn('Every user-module criterion has a test', `${id} (${cr.spec}) has no test (npm run spec:check)`);
    return {
      id,
      title: cr.title,
      spec: cr.spec,
      tests: describeTests(ts).join('\n'),
      state,
      reason: [...new Set([...ts.flatMap((t) => t.fixme.map((m) => m.reason)), ...fail.map((f) => f.reason)])].join('\n'),
      tcs: tcs.join(', '),
      note: tcs.length ? '' : 'Not in the QA sheet: extra coverage',
    };
  });

// ───────────────────────── Excel ─────────────────────────
const COLORS = {
  Covered: 'FFC6EFCE',
  Partial: 'FFFFEB9C',
  TODO: 'FFBDD7EE',
  Blocker: 'FFFFC7CE',
  'Not covered': 'FFE7E6E6',
  header: 'FF1F3864',
  bug: 'FFF8CBAD',
};
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const border = { top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } } };

const CASE_COLUMNS = [
  { header: 'Case code', key: 'tc', width: 11 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Area', key: 'area', width: 17 },
  { header: 'What it checks', key: 'about', width: 42, wrap: true },
  { header: 'Remaining', key: 'remaining', width: 12 },
  { header: 'Reason / what is left', key: 'reason', width: 50, wrap: true },
  { header: 'Known app bug', key: 'knownBug', width: 11 },
  { header: 'App bug (from test.fail)', key: 'bugReason', width: 45, wrap: true },
  { header: 'Covered by (criteria)', key: 'coveredBy', width: 20, wrap: true },
  { header: 'Spec file(s)', key: 'specs', width: 38, wrap: true },
  { header: 'Test(s) in code', key: 'tests', width: 70, wrap: true },
  { header: 'Test notes', key: 'testNotes', width: 35, wrap: true },
  { header: 'Run it', key: 'run', width: 46, wrap: true },
  { header: 'Sheet vs app', key: 'mismatch', width: 45, wrap: true },
  { header: 'Client / env', key: 'client', width: 13 },
  { header: 'Needs setting', key: 'setting', width: 24, wrap: true },
  { header: 'QA sheet title', key: 'sheetTitle', width: 50 },
  { header: 'Priority', key: 'priority', width: 9 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'Tags', key: 'tags', width: 18 },
  { header: 'Precondition', key: 'precondition', width: 40 },
  { header: 'Steps', key: 'steps', width: 60 },
  { header: 'Expected result', key: 'expected', width: 60 },
  { header: 'Sheet row', key: 'sheetRow', width: 9 },
];

function styleHeader(ws) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = fill(COLORS.header);
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 30;
}

function addTable(wb, name, columns, data, { tabColor, statusKey } = {}) {
  const ws = wb.addWorksheet(name, { properties: tabColor ? { tabColor: { argb: tabColor } } : {}, views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  ws.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
  for (const r of data) ws.addRow(r);
  styleHeader(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border;
      cell.alignment = { vertical: 'top', wrapText: !!columns[col - 1]?.wrap };
    });
    if (statusKey) {
      const status = row.getCell(statusKey).value;
      if (COLORS[status]) row.getCell(statusKey).fill = fill(COLORS[status]);
      const bug = row.getCell('knownBug');
      if (bug.value) bug.fill = fill(COLORS.bug);
    }
  });
  if (statusKey) ws.getColumn(1).font = { bold: true };
  return ws;
}

const wb = new ExcelJS.Workbook();
wb.creator = 'bizom-e2e scripts/user-coverage.mjs';
wb.created = new Date();

// Summary
const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: COLORS.header } } });
ws.columns = [{ width: 24 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }];
const today = new Date().toISOString().slice(0, 10);
ws.addRow(['User module: QA sheet vs automated tests']).font = { bold: true, size: 16 };
ws.addRow([`Generated ${today} by npm run coverage:users. Do not edit by hand: change ${MAPPING} or the tests, then run it again.`]).font = { italic: true, color: { argb: 'FF595959' } };
ws.addRow([`QA sheet: ${SHEET_CSV} (${sheet.size} cases)   ·   Mapping: ${MAPPING}   ·   Tests: tests/ (${tests.length} tests listed)`]);
const errors = problems.filter((p) => p.level === 'Error');
const checkRow = ws.addRow([errors.length ? `Checks: ${errors.length} error(s), ${problems.length - errors.length} warning(s). See the Checks tab.` : `Checks: mapping, specs and code agree${problems.length ? ` (${problems.length} warning(s), see Checks)` : ''}.`]);
checkRow.font = { bold: true, color: { argb: errors.length ? 'FFC00000' : 'FF00703C' } };
ws.addRow([]);

const statusHeader = ws.addRow(['Status', 'Cases', '% of sheet', 'What it means']);
statusHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
statusHeader.eachCell((c) => (c.fill = fill(COLORS.header)));
for (const st of STATUSES) {
  const n = rows.filter((r) => r.status === st).length;
  const r = ws.addRow([st, n, n / rows.length, STATUS_HELP[st]]);
  r.getCell(1).fill = fill(COLORS[st]);
  r.getCell(3).numFmt = '0%';
  ws.mergeCells(r.number, 4, r.number, 8);
  r.getCell(4).alignment = { wrapText: true, vertical: 'top' };
  r.height = 30;
}
const total = ws.addRow(['Total', rows.length, 1]);
total.font = { bold: true };
total.getCell(3).numFmt = '0%';
const bugs = rows.filter((r) => r.knownBug).length;
ws.addRow(['Known app bugs', bugs, '', 'Cases whose test is marked test.fail: tested, but the app does not do what the sheet expects (column "App bug").']);
ws.mergeCells(ws.lastRow.number, 4, ws.lastRow.number, 8);
ws.addRow([]);

const areaHeader = ws.addRow(['Area', ...STATUSES, 'Total']);
areaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
areaHeader.eachCell((c) => (c.fill = fill(COLORS.header)));
const areas = [...new Set(userModuleCases.map((c) => c.area))];
for (const area of areas) {
  const inArea = rows.filter((r) => r.area === area);
  const r = ws.addRow([area, ...STATUSES.map((st) => inArea.filter((x) => x.status === st).length || ''), inArea.length]);
  STATUSES.forEach((st, i) => { if (r.getCell(i + 2).value) r.getCell(i + 2).fill = fill(COLORS[st]); });
}
ws.addRow([]);
ws.addRow(['How the mapping works']).font = { bold: true, size: 13 };
for (const line of [
  `1. ${MAPPING} lists every sheet case once: the spec criteria (e.g. UFORM-03) that test it, or why it has no test.`,
  '2. Each test is linked to its criteria with spec() (fixtures/spec.ts), which also tags it with the sheet cases of those criteria (@TC8981).',
  '3. Run one sheet case: npx playwright test --grep @TC8981 (config / user-block cases: see "Run it").',
  '4. Status comes from the code: test.fixme → Blocker, test.fail → Known app bug. Nobody types a status here.',
  '5. "Code → Sheet" shows the other direction: every criterion, its tests, and the sheet cases it covers.',
]) ws.addRow([line]);

addTable(wb, 'All cases', CASE_COLUMNS, rows, { statusKey: 'status' });
for (const st of STATUSES) {
  const data = rows.filter((r) => r.status === st);
  addTable(wb, st, CASE_COLUMNS, data, { tabColor: COLORS[st], statusKey: 'status' });
}
addTable(
  wb,
  'Code → Sheet',
  [
    { header: 'Criterion', key: 'id', width: 11 },
    { header: 'Criterion title', key: 'title', width: 50, wrap: true },
    { header: 'Spec file', key: 'spec', width: 40 },
    { header: 'Test(s) in code', key: 'tests', width: 75, wrap: true },
    { header: 'Test state', key: 'state', width: 24 },
    { header: 'Reason (test.fail / fixme)', key: 'reason', width: 50, wrap: true },
    { header: 'QA sheet cases', key: 'tcs', width: 40, wrap: true },
    { header: 'Note', key: 'note', width: 32 },
  ],
  criteriaRows,
);
addTable(
  wb,
  'Checks',
  [
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Check', key: 'check', width: 42 },
    { header: 'Detail', key: 'detail', width: 120, wrap: true },
  ],
  problems.length ? problems : [{ level: 'OK', check: 'All checks', detail: 'Every sheet case is mapped once, every linked criterion has a spec and a test, tests carry their @TC tags, and spec "Sheet:" lines agree with the mapping.' }],
);

fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
await wb.xlsx.writeFile(path.join(root, OUT));

// ───────────────────────── Console ─────────────────────────
console.log(`User module coverage → ${OUT}`);
for (const st of STATUSES) console.log(`  ${st.padEnd(12)} ${String(rows.filter((r) => r.status === st).length).padStart(3)}`);
console.log(`  ${'Total'.padEnd(12)} ${String(rows.length).padStart(3)}   (known app bugs: ${bugs})`);
for (const p of problems) console.log(`  ${p.level.toUpperCase().padEnd(7)} ${p.check}: ${p.detail}`);
process.exit(errors.length ? 1 : 0);
