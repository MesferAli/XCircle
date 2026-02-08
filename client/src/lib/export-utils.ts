import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

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

export function exportToPDF(options: Omit<ExportOptions, 'format'>): void {
  const { title, subtitle, filename, columns, data, orientation = 'portrait' } = options;
  
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

export async function exportToExcel(options: Omit<ExportOptions, 'format'>): Promise<void> {
  const { title, filename, columns, data } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.slice(0, 31));

  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length, 15),
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2D40' } };

  for (const row of data) {
    const rowData: Record<string, unknown> = {};
    for (const col of columns) {
      const value = row[col.key];
      if (value === null || value === undefined) {
        rowData[col.key] = '';
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        rowData[col.key] = JSON.stringify(value);
      } else {
        rowData[col.key] = value;
      }
    }
    worksheet.addRow(rowData);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();

  URL.revokeObjectURL(url);
}

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

export async function exportData(options: ExportOptions): Promise<void> {
  switch (options.format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'excel':
      await exportToExcel(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
  }
}

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
