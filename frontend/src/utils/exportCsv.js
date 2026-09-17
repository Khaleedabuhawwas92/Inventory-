// Lightweight CSV export (opens fine in Excel) usable by any list/report page.
export function exportToCsv(filename, rows, columns) {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const value = typeof c.value === 'function' ? c.value(row) : row[c.value];
          return `"${String(value ?? '').replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');

  // BOM so Excel detects UTF-8 and renders Arabic correctly.
  const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
