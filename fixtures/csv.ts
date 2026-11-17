import fs from 'node:fs';

/**
 * Reads a CSV file (quoted fields, "" for a quote, commas and line breaks inside quotes) into one
 * object per row, keyed by the header. A leading byte-order mark is dropped.
 */
export function readCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...data] = rows.filter((r) => r.some((v) => v.trim()));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
