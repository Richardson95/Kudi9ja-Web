import type { ExportCell, ExportColumn, ExportReport } from '../types/api';

/**
 * Turns a report from the server into an Excel workbook or a PDF, in the
 * browser. The libraries are loaded only when somebody downloads, so nobody
 * else pays for them.
 */

const fileStem = (r: ExportReport) => `kudi9ja-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;

const asNumber = (v: ExportCell): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

const dateText = (v: ExportCell) => {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const moneyText = (v: ExportCell) => {
  const n = asNumber(v);
  return n === null ? '' : n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Sums of the money columns, for the last row. */
function totals(r: ExportReport): (number | null)[] {
  return r.columns.map((c, i) =>
    c.type === 'MONEY' ? r.rows.reduce((sum, row) => sum + (asNumber(row[i] ?? null) ?? 0), 0) : null,
  );
}

const generatedLine = (r: ExportReport) =>
  `${r.period} · Generated ${dateText(r.generatedAt)} by ${r.generatedBy} · ${r.rows.length} row${r.rows.length === 1 ? '' : 's'}`;

// ── Excel ───────────────────────────────────────────────────────────────

export async function downloadExcel(r: ExportReport): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const cell = (c: ExportColumn, v: ExportCell) => {
    if (v === null || v === undefined || v === '') return null;
    switch (c.type) {
      case 'MONEY':
        return { value: Number(v), type: Number, format: '#,##0.00' };
      case 'NUMBER':
        return { value: Number(v), type: Number };
      case 'DATE': {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : { value: d, type: Date, format: 'dd mmm yyyy hh:mm' };
      }
      default:
        return String(v);
    }
  };

  const sums = totals(r);
  const data = [
    [{ value: `Kudi9ja — ${r.title}`, fontWeight: 'bold' as const, fontSize: 14 }],
    [generatedLine(r)],
    [r.company],
    [],
    r.columns.map((c) => ({ value: c.label, fontWeight: 'bold' as const, backgroundColor: '#F2C46D' })),
    ...r.rows.map((row) => r.columns.map((c, i) => cell(c, row[i] ?? null))),
    ...(sums.some((s) => s !== null)
      ? [
          r.columns.map((_, i) =>
            i === 0
              ? { value: 'Total', fontWeight: 'bold' as const }
              : sums[i] === null
                ? null
                : { value: sums[i]!, type: Number, format: '#,##0.00', fontWeight: 'bold' as const },
          ),
        ]
      : []),
  ];

  // Wide enough for the heading or the longest value, within reason.
  const columns = r.columns.map((c, i) => {
    const longest = r.rows.reduce((m, row) => {
      const v = row[i];
      const text = c.type === 'DATE' ? dateText(v ?? null) : c.type === 'MONEY' ? moneyText(v ?? null) : String(v ?? '');
      return Math.max(m, text.length);
    }, c.label.length);
    return { width: Math.min(Math.max(longest + 2, 10), 48) };
  });

  // Sheet names are limited to 31 characters and some symbols.
  await writeXlsxFile(data as never, { columns, sheet: r.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), stickyRowsCount: 5 }).toFile(
    `${fileStem(r)}.xlsx`,
  );
}

// ── PDF ─────────────────────────────────────────────────────────────────

/**
 * The PDF's built-in fonts carry Latin-1 only: no ₦, no long dash, no bullet.
 * Those are written out instead, so nothing prints as a stray symbol.
 */
function pdfText(s: string): string {
  return s
    .replace(/₦/g, 'NGN ')
    .replace(/[—–]/g, '-')
    .replace(/•/g, '*')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFF]/g, '?');
}

export async function downloadPdf(r: ExportReport): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const wide = r.columns.length > 12;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: wide ? 'a3' : 'a4' });
  const margin = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(pdfText(`Kudi9ja - ${r.title}`), margin, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(pdfText(generatedLine(r)), margin, 56);
  doc.setTextColor(0);

  const format = (c: ExportColumn, v: ExportCell) =>
    c.type === 'MONEY' ? moneyText(v) : c.type === 'DATE' ? dateText(v) : c.type === 'NUMBER' ? (v ?? '').toString() : pdfText(String(v ?? ''));

  const sums = totals(r);
  const hasTotals = sums.some((s) => s !== null);

  autoTable(doc, {
    startY: 68,
    margin: { left: margin, right: margin, bottom: 36 },
    head: [r.columns.map((c) => pdfText(c.type === 'MONEY' ? `${c.label} (NGN)` : c.label))],
    body: r.rows.map((row) => r.columns.map((c, i) => format(c, row[i] ?? null))),
    foot: hasTotals ? [r.columns.map((_, i) => (i === 0 ? 'Total' : sums[i] === null ? '' : moneyText(sums[i]!)))] : undefined,
    showFoot: 'lastPage',
    styles: { fontSize: wide ? 7 : 8, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [232, 163, 61], textColor: 20, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 236, 220], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 246, 242] },
    columnStyles: Object.fromEntries(
      r.columns.map((c, i) => [i, c.type === 'MONEY' || c.type === 'NUMBER' ? { halign: 'right' as const } : {}]),
    ),
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      const h = doc.internal.pageSize.getHeight();
      const w = doc.internal.pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(pdfText(`${r.company} · Confidential: contains customers' personal data`), margin, h - 16);
      doc.text(`Page ${page}`, w - margin, h - 16, { align: 'right' });
      doc.setTextColor(0);
    },
  });

  doc.save(`${fileStem(r)}.pdf`);
}
