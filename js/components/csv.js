// Minimal, dependency-free CSV/TSV parser and writer — no external library,
// consistent with the rest of this app. Handles quoted fields (embedded
// delimiters, quotes, and newlines) per the common CSV convention, since a
// workout template needs to round-trip cleanly through Excel, Google
// Sheets, or Numbers without anything breaking.

function detectDelimiter(text) {
  // Pasting straight from a spreadsheet produces tab-separated text, while
  // an uploaded template is comma-separated — auto-detect from whichever
  // the header line uses more of.
  const firstLine = text.split(/\r\n|\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

export function parseDelimited(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  // Drop fully-blank trailing rows (common with trailing blank lines).
  const cleaned = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const [headerRow, ...dataRows] = cleaned;
  return {
    headers: (headerRow || []).map((h) => h.trim()),
    rows: dataRows,
  };
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
  return lines.join('\r\n');
}

export function downloadTextFile(filename, content, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
