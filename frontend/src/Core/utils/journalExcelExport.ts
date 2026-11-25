import dayjs from 'dayjs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';

import type { JournalColumn, JournalRow } from '../types/common';

/** Полезная ширина листа A4 landscape (символы Excel wch) при узких полях. */
const A4_LANDSCAPE_CHARS = 108;
const MIN_COL_WCH = 8;
const MAX_TEXT_WCH = 40;
const MAX_DATE_WCH = 12;
const MAX_CONFIRM_WCH = 24;
/** Минимальная «комфортная» ширина текстовой колонки, когда места достаточно. */
const COMFORT_TEXT_WCH = 18;

type ColMeta = { title: string; type: JournalColumn['type'] | 'confirmation' };

function formatCellValue(val: string | null | undefined, type: ColMeta['type']): string {
  if (!val) return '';
  if (type === 'date' && dayjs(val).isValid()) return dayjs(val).format('DD.MM.YYYY');
  return val;
}

function maxWidthForType(type: ColMeta['type']): number {
  if (type === 'date') return MAX_DATE_WCH;
  if (type === 'confirmation') return MAX_CONFIRM_WCH;
  return MAX_TEXT_WCH;
}

function preferredWidth(meta: ColMeta, contentMaxLen: number): number {
  const max = maxWidthForType(meta.type);
  if (meta.type === 'date') return Math.min(Math.max(contentMaxLen, 10), max);
  if (meta.type === 'confirmation') return Math.min(Math.max(contentMaxLen, 14), max);
  // Текстовые: не уже COMFORT, если контент короткий — чтобы при 3 колонках не были «палками»
  return Math.min(Math.max(contentMaxLen + 1, COMFORT_TEXT_WCH), max);
}

/** Перенос по словам под фактическую ширину колонки (для всех колонок). */
function wrapText(text: string, width: number): string {
  const w = Math.max(width, 4);
  if (!text || text.length <= w) return text;

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  const pushLongWord = (word: string) => {
    for (let i = 0; i < word.length; i += w) {
      lines.push(word.slice(i, i + w));
    }
  };

  for (const word of words) {
    if (!line) {
      if (word.length > w) pushLongWord(word);
      else line = word;
      continue;
    }
    if (line.length + 1 + word.length <= w) {
      line = `${line} ${word}`;
      continue;
    }
    lines.push(line);
    if (word.length > w) {
      line = '';
      pushLongWord(word);
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Ширины колонок:
 * - мало колонок → расширяем до заполнения A4 (но не больше MAX на колонку);
 * - много колонок → сжимаем пропорционально, чтобы сумма ≤ A4.
 */
function calcColWidths(metas: ColMeta[], rawRows: string[][]): number[] {
  const preferred = metas.map((meta, i) => {
    let maxLen = meta.title.length;
    for (const row of rawRows) {
      maxLen = Math.max(maxLen, (row[i] ?? '').length);
    }
    return preferredWidth(meta, maxLen);
  });

  const total = preferred.reduce((a, b) => a + b, 0);
  if (total === 0) return preferred;

  if (total <= A4_LANDSCAPE_CHARS) {
    // Растягиваем до ширины страницы, не превышая max по типу
    const widths = [...preferred];
    let extra = A4_LANDSCAPE_CHARS - total;
    while (extra > 0) {
      const growable = widths
        .map((w, i) => (w < maxWidthForType(metas[i].type) ? i : -1))
        .filter((i) => i >= 0);
      if (growable.length === 0) break;
      for (const i of growable) {
        if (extra <= 0) break;
        if (widths[i] >= maxWidthForType(metas[i].type)) continue;
        widths[i] += 1;
        extra -= 1;
      }
    }
    return widths;
  }

  // Не помещаются — сжимаем пропорционально, сохраняя минимум
  const scale = A4_LANDSCAPE_CHARS / total;
  let widths = preferred.map((w) => Math.max(MIN_COL_WCH, Math.floor(w * scale)));
  let sum = widths.reduce((a, b) => a + b, 0);

  // Подгоняем сумму ровно под бюджет (с учётом округления)
  while (sum > A4_LANDSCAPE_CHARS) {
    let idx = -1;
    let best = -1;
    for (let i = 0; i < widths.length; i += 1) {
      if (widths[i] > MIN_COL_WCH && widths[i] > best) {
        best = widths[i];
        idx = i;
      }
    }
    if (idx < 0) break;
    widths[idx] -= 1;
    sum -= 1;
  }
  while (sum < A4_LANDSCAPE_CHARS) {
    let idx = -1;
    let room = -1;
    for (let i = 0; i < widths.length; i += 1) {
      const r = maxWidthForType(metas[i].type) - widths[i];
      if (r > room) {
        room = r;
        idx = i;
      }
    }
    if (idx < 0 || room <= 0) break;
    widths[idx] += 1;
    sum += 1;
  }

  return widths;
}

function buildExportGrid(
  columns: Array<Omit<JournalColumn, 'journal_id'> | JournalColumn>,
  rows: JournalRow[],
): { headers: string[]; dataRows: string[][]; widths: number[]; metas: ColMeta[] } {
  const dataCols = columns.filter((c) => c.type !== 'confirmation');
  const confirmCol = columns.find((c) => c.type === 'confirmation');

  const metas: ColMeta[] = [
    ...dataCols.map((c) => ({ title: c.title || '', type: c.type })),
    ...(confirmCol ? [{ title: 'Подпись М\\С', type: 'confirmation' as const }] : []),
  ];

  const headers = metas.map((m) => m.title);

  const rawRows = rows.map((row) => {
    const cells = dataCols.map((col) => formatCellValue(row.values?.[col.id], col.type));
    if (confirmCol) {
      cells.push(
        row.confirmation_status === 'active' ? (row.signer_full_name ?? '') : '',
      );
    }
    return cells;
  });

  const widths = calcColWidths(metas, rawRows);

  // Перенос слов во ВСЕХ колонках (заголовки и данные) под фактическую ширину
  const wrappedHeaders = headers.map((h, i) => wrapText(h, widths[i]));
  const dataRows = rawRows.map((row) =>
    row.map((cell, i) => wrapText(cell, widths[i])),
  );

  return { headers: wrappedHeaders, dataRows, widths, metas };
}

function applySheetLayout(ws: XLSX.WorkSheet, colCount: number, rowCount: number, widths: number[]): void {
  ws['!cols'] = widths.map((wch) => ({ wch }));
  ws['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.35,
    header: 0.2,
    footer: 0.2,
  };

  const rowsMeta: XLSX.RowInfo[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    let maxLines = 1;
    for (let c = 0; c < colCount; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      const text = cell?.v != null ? String(cell.v) : '';
      maxLines = Math.max(maxLines, text.split('\n').length);
    }
    rowsMeta[r] = { hpt: Math.min(14 + maxLines * 12, 90) };
  }
  ws['!rows'] = rowsMeta;
}

/**
 * Community SheetJS не пишет стили — дописываем wrap + шапку в готовый xlsx.
 * pageSetup не трогаем: Excel часто отвергает такие правки после перепаковки ZIP.
 */
function patchXlsxStyles(data: Uint8Array): Uint8Array {
  const files = unzipSync(data);

  // metadata.xml от SheetJS после re-zip иногда ломает Excel — убираем
  delete files['xl/metadata.xml'];
  const ctPath = '[Content_Types].xml';
  if (files[ctPath]) {
    let ct = strFromU8(files[ctPath]);
    ct = ct.replace(/<Override[^>]*PartName="\/xl\/metadata\.xml"[^>]*\/>/g, '');
    files[ctPath] = strToU8(ct);
  }
  const wbRels = 'xl/_rels/workbook.xml.rels';
  if (files[wbRels]) {
    let rels = strFromU8(files[wbRels]);
    rels = rels.replace(/<Relationship[^>]*Target="metadata\.xml"[^>]*\/>/g, '');
    files[wbRels] = strToU8(rels);
  }

  const stylesPath = 'xl/styles.xml';
  if (files[stylesPath]) {
    let styles = strFromU8(files[stylesPath]);

    styles = styles.replace(
      /<fonts[^>]*>[\s\S]*?<\/fonts>/,
      `<fonts count="2">` +
        `<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>` +
        `<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>` +
        `</fonts>`,
    );

    styles = styles.replace(
      /<fills[^>]*>[\s\S]*?<\/fills>/,
      `<fills count="3">` +
        `<fill><patternFill patternType="none"/></fill>` +
        `<fill><patternFill patternType="gray125"/></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor rgb="FFD9D9D9"/></patternFill></fill>` +
        `</fills>`,
    );

    // borders[0]=без рамки, borders[1]=тонкая чёрная рамка для таблицы
    const thinBorder = `<left style="thin"><color rgb="FF000000"/></left>` +
      `<right style="thin"><color rgb="FF000000"/></right>` +
      `<top style="thin"><color rgb="FF000000"/></top>` +
      `<bottom style="thin"><color rgb="FF000000"/></bottom>` +
      `<diagonal/>`;
    styles = styles.replace(
      /<borders[^>]*>[\s\S]*?<\/borders>/,
      `<borders count="2">` +
        `<border><left/><right/><top/><bottom/><diagonal/></border>` +
        `<border>${thinBorder}</border>` +
        `</borders>`,
    );

    styles = styles.replace(
      /<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/,
      `<cellXfs count="3">` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">` +
        `<alignment wrapText="1" vertical="top"/>` +
        `</xf>` +
        `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">` +
        `<alignment wrapText="1" vertical="center" horizontal="center"/>` +
        `</xf>` +
        `</cellXfs>`,
    );
    files[stylesPath] = strToU8(styles);
  }

  for (const name of Object.keys(files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    let sheet = strFromU8(files[name]);

    // Строка 1 — шапка (s="2"), остальные — wrap (s="1")
    sheet = sheet.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (_full, attrs: string, content: string) => {
      const rowMatch = /\br="(\d+)"/.exec(attrs);
      const styleId = rowMatch && rowMatch[1] === '1' ? '2' : '1';
      const nextContent = content.replace(/<c\b([^>]*)>/g, (_m: string, cellAttrs: string) => {
        if (/\bs="/.test(cellAttrs)) {
          return `<c${cellAttrs.replace(/\bs="[^"]*"/, ` s="${styleId}"`)}>`;
        }
        return `<c s="${styleId}"${cellAttrs}>`;
      });
      return `<row${attrs}>${nextContent}</row>`;
    });

    files[name] = strToU8(sheet);
  }

  // Как у SheetJS: STORE + [Content_Types].xml первым — лучше совместимость с Excel
  const ordered: Record<string, Uint8Array> = {};
  const keys = Object.keys(files).sort((a, b) => {
    if (a === '[Content_Types].xml') return -1;
    if (b === '[Content_Types].xml') return 1;
    return a.localeCompare(b);
  });
  for (const key of keys) {
    ordered[key] = files[key];
  }

  return zipSync(ordered, { level: 0 });
}

function triggerDownload(data: Uint8Array, filename: string): void {
  // Копия буфера — чтобы Blob не ссылался на view с неожиданным byteOffset
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Нельзя revoke сразу: браузер ещё не успел прочитать blob → битый файл
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Excel-выгрузка: ширины под A4 landscape + перенос слов во всех колонках. */
export function downloadJournalExcel(
  title: string,
  columns: Array<Omit<JournalColumn, 'journal_id'> | JournalColumn>,
  rows: JournalRow[],
): void {
  const { headers, dataRows, widths } = buildExportGrid(columns, rows);
  const aoa = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applySheetLayout(ws, headers.length, aoa.length, widths);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Journal');
  const raw = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const patched = patchXlsxStyles(raw);

  const safe = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  triggerDownload(patched, `${safe || 'journal'}.xlsx`);
}

/** Печать журнала: одна ширина страницы A4 landscape, перенос слов в ячейках. */
export function printJournal(
  title: string,
  departmentName: string | undefined,
  columns: Array<Omit<JournalColumn, 'journal_id'> | JournalColumn>,
  rows: JournalRow[],
): void {
  const { headers, dataRows } = buildExportGrid(columns, rows);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
  if (!win) return;

  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br/>');

  const headCells = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const bodyRows = dataRows
    .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body {
        font-family: "Times New Roman", Times, serif;
        font-size: 10pt;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h1 {
        font-size: 13pt;
        font-weight: bold;
        margin: 0 0 4px;
        text-align: center;
      }
      .meta {
        font-size: 9pt;
        margin: 0 0 8px;
        text-align: center;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #000;
        padding: 3px 4px;
        vertical-align: top;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      }
      th {
        font-weight: bold;
        text-align: center;
        background: #f3f3f3;
      }
    </style>
  </head><body>
    <h1>${esc(title)}</h1>
    ${departmentName ? `<p class="meta">${esc(departmentName)}</p>` : ''}
    <table>
      <thead><tr>${headCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}
