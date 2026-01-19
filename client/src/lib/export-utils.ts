/**
 * Export Utilities with Lazy Loading
 *
 * OPTIMIZATION: Heavy libraries (jsPDF ~200KB, XLSX ~350KB) are loaded dynamically
 * only when the user actually exports data. This reduces initial bundle size by ~550KB.
 */

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  format: ExportFormat;
  orientation?: 'portrait' | 'landscape';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleDateString('ar-SA');
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Export to PDF - lazily loads jsPDF and jspdf-autotable
 */
export async function exportToPDF(options: Omit<ExportOptions, 'format'>): Promise<void> {
  const { title, subtitle, filename, columns, data, orientation = 'portrait' } = options;

  // Dynamic import - only loaded when user exports to PDF
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(28, 45, 64);
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 28);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const dateStr = new Date().toLocaleString('ar-SA');
  doc.text(`Generated: ${dateStr}`, 14, subtitle ? 35 : 28);

  const tableData = data.map(row =>
    columns.map(col => formatValue(row[col.key]))
  );

  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: subtitle ? 42 : 35,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [28, 45, 64],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'Atlas - Enterprise AI Layer',
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Export to Excel - lazily loads xlsx library
 */
export async function exportToExcel(options: Omit<ExportOptions, 'format'>): Promise<void> {
  const { title, filename, columns, data } = options;

  // Dynamic import - only loaded when user exports to Excel
  const XLSX = await import('xlsx');

  const worksheetData = [
    columns.map(col => col.header),
    ...data.map(row => columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object' && !(value instanceof Date)) {
        return JSON.stringify(value);
      }
      return value;
    }))
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  const colWidths = columns.map(col => ({
    wch: col.width || Math.max(col.header.length, 15)
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export to CSV - no external dependencies, always synchronous
 */
export function exportToCSV(options: Omit<ExportOptions, 'format'>): void {
  const { filename, columns, data } = options;

  const headers = columns.map(col => `"${col.header}"`).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const value = formatValue(row[col.key]);
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Main export function - handles all formats with lazy loading
 */
export async function exportData(options: ExportOptions): Promise<void> {
  switch (options.format) {
    case 'pdf':
      await exportToPDF(options);
      break;
    case 'excel':
      await exportToExcel(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
  }
}

// Column definitions for different data types
export const recommendationColumns: ExportColumn[] = [
  { header: 'Title', key: 'title', width: 30 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'Priority', key: 'priority', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Confidence', key: 'confidenceScore', width: 12 },
  { header: 'Description', key: 'description', width: 40 },
];

export const anomalyColumns: ExportColumn[] = [
  { header: 'Title', key: 'title', width: 30 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Severity', key: 'severity', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Deviation %', key: 'deviation', width: 12 },
  { header: 'Detected', key: 'createdAt', width: 15 },
];

export const auditLogColumns: ExportColumn[] = [
  { header: 'Sequence', key: 'sequenceNumber', width: 10 },
  { header: 'Action', key: 'action', width: 12 },
  { header: 'Event Type', key: 'eventType', width: 15 },
  { header: 'Resource Type', key: 'resourceType', width: 15 },
  { header: 'Resource ID', key: 'resourceId', width: 20 },
  { header: 'User', key: 'userId', width: 15 },
  { header: 'Timestamp', key: 'timestamp', width: 18 },
  { header: 'IP Address', key: 'ipAddress', width: 15 },
];

export const inventoryColumns: ExportColumn[] = [
  { header: 'SKU', key: 'sku', width: 15 },
  { header: 'Name', key: 'name', width: 25 },
  { header: 'Category', key: 'category', width: 15 },
  { header: 'Quantity', key: 'quantity', width: 10 },
  { header: 'Unit Cost', key: 'unitCost', width: 12 },
  { header: 'Reorder Point', key: 'reorderPoint', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
];
