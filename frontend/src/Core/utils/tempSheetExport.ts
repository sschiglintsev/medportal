import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import type { TempSheet, TempSheetColumnData } from '../types/common';
import { TEMP_BAND_LABELS } from '../types/common';
import {
  COLUMN_COUNT,
  TEMP_SHEET_ROWS,
  TEMP_SHEET_TITLE,
  formatAge,
  formatDateDisplay,
  formatTimeDisplay,
} from './tempSheetForm';

function cellText(col: TempSheetColumnData, rowKey: string): string {
  const row = TEMP_SHEET_ROWS.find((r) => r.key === rowKey);
  if (!row) return '';
  if (row.kind === 'temp_header') return '';
  if (row.kind === 'temp_band') {
    return col.temperature_band === row.band ? '●' : '';
  }
  if (row.kind === 'observation_date') return formatDateDisplay(col.observation_date);
  if (row.kind === 'observation_time') return formatTimeDisplay(col.observation_time);
  if (row.field) {
    const v = col[row.field];
    return v == null ? '' : String(v);
  }
  return '';
}

/** Excel: таблица + отметки, без линии и диаграммы. */
export function downloadTempSheetExcel(sheet: TempSheet, columns: TempSheetColumnData[]): void {
  const header = [
    'Показатель',
    ...Array.from({ length: COLUMN_COUNT }, (_, i) => String(i + 1)),
  ];

  const titleRow = [TEMP_SHEET_TITLE, ...Array(COLUMN_COUNT).fill('')];
  const metaRow = [
    `ФИО: ${sheet.patient_name}; возраст: ${formatAge(sheet.birth_date)}; рост, см: ${sheet.height_cm ?? ''}; отделение: ${sheet.department_name}`,
    ...Array(COLUMN_COUNT).fill(''),
  ];

  const dataRows = TEMP_SHEET_ROWS.map((row) => [
    row.label,
    ...columns.map((col) => cellText(col, row.key)),
  ]);

  const aoa = [titleRow, metaRow, header, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ширины
  ws['!cols'] = [{ wch: 22 }, ...Array.from({ length: COLUMN_COUNT }, () => ({ wch: 10 }))];

  // Настройка печати (поддерживается читателями Excel; community SheetJS — best-effort)
  (ws as XLSX.WorkSheet & { '!pageSetup'?: Record<string, unknown> })['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9,
    fitToWidth: 1,
    fitToHeight: 1,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Темп. лист');
  const safeName = sheet.patient_name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `temperaturnyy_list_${safeName}.xlsx`);
}

/** PDF: одна страница A4 landscape из DOM-узла бланка. */
export async function downloadTempSheetPdf(element: HTMLElement, fileBase: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;

  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(usableW / imgW, usableH / imgH);
  const drawW = imgW * ratio;
  const drawH = imgH * ratio;
  const x = margin + (usableW - drawW) / 2;
  const y = margin + (usableH - drawH) / 2;

  pdf.addImage(imgData, 'JPEG', x, y, drawW, drawH);
  pdf.save(`${fileBase}.pdf`);
}

export function printTempSheetElement(element: HTMLElement): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Печать</title>
    <style>
      @page { size: A4 landscape; margin: 6mm; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head><body></body></html>`);
  win.document.close();
  const clone = element.cloneNode(true) as HTMLElement;
  win.document.body.appendChild(clone);
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}

export { TEMP_BAND_LABELS };
