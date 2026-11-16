import ExcelJS from 'exceljs';

export interface SheetExportConfig {
  sheetName: string;
  rows: Array<Record<string, unknown>>;
}

export interface ParsedWorkbookData {
  sheetNames: string[];
  sheetsByRows: Record<string, unknown[][]>;
  sheetsByObjects: Record<string, Array<Record<string, unknown>>>;
}

const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024; // 10 MB hard upload safety limit
const MAX_SPREADSHEET_ROWS = 50_000;

/**
 * Formats Date cleanly as ISO YYYY-MM-DD, preserves negative numbers without corrupting them
 * with a visible leading apostrophe, and neutralizes dangerous Excel formula triggers.
 */
function sanitizeExcelCellValue(val: unknown): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  const str = String(val);
  const trimmed = str.trim();
  // Convert valid numeric strings (including negative decimals) to real numbers instead of prefixing '
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    // Keep leading-zero identifiers (like "00123" or >=10-digit mobiles) as text strings
    if (!/^0\d+/.test(trimmed) && !/^-0\d+/.test(trimmed) && trimmed.replace('-', '').length < 10) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) return num;
    }
    return str;
  }
  // Only neutralize non-numeric formula payloads (=, +, @, or non-numeric -)
  if (/^[=+@]/.test(trimmed) || (/^-/.test(trimmed) && !/^-\d/.test(trimmed))) {
    return `\u200B${str}`;
  }
  return str;
}

function unwrapExcelJsCellValue(val: unknown): unknown {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part: unknown) =>
          part && typeof part === 'object' && 'text' in (part as Record<string, unknown>)
            ? String((part as Record<string, unknown>).text ?? '')
            : ''
        )
        .join('');
    }
    if ('error' in obj && obj.error !== undefined) {
      return typeof obj.error === 'string' ? obj.error : '';
    }
    if ('result' in obj) {
      return obj.result === undefined ? '' : unwrapExcelJsCellValue(obj.result);
    }
    if ('text' in obj && obj.text !== undefined) {
      return typeof obj.text === 'object' ? unwrapExcelJsCellValue(obj.text) : String(obj.text);
    }
    if ('hyperlink' in obj && typeof obj.hyperlink === 'string') {
      return obj.hyperlink;
    }
    return '';
  }
  return String(val);
}

/**
 * Generates a unique Excel worksheet name capped at 31 characters after sanitization.
 */
function buildUniqueSheetName(rawName: string, usedNames: Set<string>, index: number): string {
  const cleaned =
    (rawName || `Sheet${index + 1}`)
      .replace(/[\\/?*[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || `Sheet${index + 1}`;
  let candidate = cleaned.slice(0, 31).trim() || `Sheet${index + 1}`;
  let suffixCounter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = `_${suffixCounter}`;
    const base = cleaned.slice(0, Math.max(1, 31 - suffix.length)).trim();
    candidate = `${base}${suffix}`;
    suffixCounter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Exports one or more sheets of JSON records as a downloadable .xlsx file using ExcelJS.
 */
export async function exportJsonSheetsToExcelFile(
  sheets: SheetExportConfig[],
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RLSY College ERP';
  workbook.created = new Date();
  const usedSheetNames = new Set<string>();

  for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
    const sheetCfg = sheets[sIdx];
    const cleanSheetName = buildUniqueSheetName(sheetCfg.sheetName, usedSheetNames, sIdx);
    const worksheet = workbook.addWorksheet(cleanSheetName);
    const rows = sheetCfg.rows || [];

    if (rows.length > 0) {
      // Collect union of all column keys across every row (never only rows[0])
      const headerSet = new Set<string>();
      for (const row of rows) {
        if (row && typeof row === 'object') {
          for (const key of Object.keys(row)) {
            headerSet.add(key);
          }
        }
      }
      const headers = Array.from(headerSet);

      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.max(14, Math.min(38, header.length + 6)),
      }));

      for (const row of rows) {
        const sanitizedRow: Record<string, string | number | boolean> = {};
        for (const h of headers) {
          sanitizedRow[h] = sanitizeExcelCellValue(row ? row[h] : '');
        }
        worksheet.addRow(sanitizedRow);
      }

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

/**
 * Full RFC-4180 CSV parser supporting UTF-8 BOM stripping, escaped double quotes (""),
 * and quoted fields containing embedded newlines (\r\n or \n).
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"' && currentField.trim() === '') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
        if (rows.length > MAX_SPREADSHEET_ROWS) {
          throw new Error(`Spreadsheet exceeds maximum allowed limit of ${MAX_SPREADSHEET_ROWS.toLocaleString()} rows.`);
        }
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function shouldKeepAsString(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  // Preserve leading zeros (e.g., 00123, 0987654321) and phone-length/large integer IDs as strings
  if (/^0\d+/.test(trimmed) || /^-0\d+/.test(trimmed)) return true;
  if (/^\d{10,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Parses an uploaded .xlsx or .csv buffer into multi-sheet 2D rows and object records using ExcelJS.
 * Rejects oversized or corrupt binary files cleanly without falling back to CSV binary garbage.
 */
export async function parseWorkbookSheets(
  buffer: ArrayBuffer,
  fileName: string = 'upload.xlsx'
): Promise<ParsedWorkbookData> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.byteLength > MAX_SPREADSHEET_BYTES) {
    throw new Error('Uploaded file exceeds maximum allowed size of 10 MB.');
  }

  const lower = (fileName || '').toLowerCase();
  const bytes = new Uint8Array(buffer);
  const looksLikeZipOrBinary =
    (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) ||
    (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0);

  if (!lower.endsWith('.csv')) {
    if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
      throw new Error('Legacy binary .xls files are not supported. Please save and upload as .xlsx or .csv.');
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      if (workbook.worksheets.length === 0) {
        throw new Error('Workbook contains no readable worksheets.');
      }

      const sheetNames: string[] = [];
      const sheetsByRows: Record<string, unknown[][]> = {};
      const sheetsByObjects: Record<string, Array<Record<string, unknown>>> = {};

      for (const ws of workbook.worksheets) {
        const sName = ws.name || `Sheet_${sheetNames.length + 1}`;
        sheetNames.push(sName);

        const matrix: unknown[][] = [];
        ws.eachRow({ includeEmpty: true }, (row) => {
          if (matrix.length >= MAX_SPREADSHEET_ROWS) {
            throw new Error(`Worksheet "${sName}" exceeds maximum limit of ${MAX_SPREADSHEET_ROWS.toLocaleString()} rows.`);
          }
          const rowVals: unknown[] = [];
          const maxCol = Math.max(row.cellCount, row.actualCellCount);
          for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            rowVals.push(unwrapExcelJsCellValue(cell.value));
          }
          matrix.push(rowVals);
        });
        sheetsByRows[sName] = matrix;

        const nonEmptyMatrix = matrix.filter((r) =>
          r.some((cell) => String(cell ?? '').trim() !== '')
        );
        if (nonEmptyMatrix.length >= 2) {
          const headerRow = nonEmptyMatrix[0].map((c, idx) => {
            const s = String(c ?? '').replace(/^\uFEFF/, '').trim();
            return s || `Column_${idx + 1}`;
          });
          const objects: Array<Record<string, unknown>> = [];
          for (let rIdx = 1; rIdx < nonEmptyMatrix.length; rIdx++) {
            const rowArr = nonEmptyMatrix[rIdx];
            const obj: Record<string, unknown> = {};
            headerRow.forEach((h, colIdx) => {
              obj[h] = rowArr[colIdx] ?? '';
            });
            objects.push(obj);
          }
          sheetsByObjects[sName] = objects;
        } else {
          sheetsByObjects[sName] = [];
        }
      }

      return { sheetNames, sheetsByRows, sheetsByObjects };
    } catch (err) {
      // Never parse corrupt .xlsx / binary zip payloads as CSV text
      if (lower.endsWith('.xlsx') || looksLikeZipOrBinary) {
        throw new Error(
          `Corrupt or invalid Excel (.xlsx) file: ${err instanceof Error ? err.message : 'Unable to read workbook'}`
        );
      }
    }
  }

  if (looksLikeZipOrBinary) {
    throw new Error('File appears to be a binary workbook renamed to .csv. Please upload a valid UTF-8 CSV or .xlsx file.');
  }

  const text = new TextDecoder('utf-8').decode(buffer);
  const matrix = parseCsvMatrix(text);
  const objects: Array<Record<string, unknown>> = [];

  if (matrix.length >= 2) {
    const headers = matrix[0].map((h, i) => h.replace(/^\uFEFF/, '').trim() || `Column_${i + 1}`);
    for (let idx = 1; idx < matrix.length; idx++) {
      const values = matrix[idx];
      const obj: Record<string, unknown> = {};
      let hasContent = false;
      headers.forEach((h, colIdx) => {
        const raw = values[colIdx] ?? '';
        if (raw !== '') hasContent = true;
        if (!shouldKeepAsString(raw) && /^-?\d+(\.\d+)?$/.test(raw)) {
          const num = Number(raw);
          obj[h] = Number.isFinite(num) ? num : raw;
        } else {
          obj[h] = raw;
        }
      });
      if (hasContent) objects.push(obj);
    }
  }

  return {
    sheetNames: ['Sheet1'],
    sheetsByRows: { Sheet1: matrix },
    sheetsByObjects: { Sheet1: objects },
  };
}

/**
 * Convenience helper returning the first worksheet's rows as JSON objects.
 */
export async function parseSpreadsheetBufferToJson(
  buffer: ArrayBuffer,
  fileName: string = 'upload.xlsx'
): Promise<Array<Record<string, unknown>>> {
  const parsed = await parseWorkbookSheets(buffer, fileName);
  const firstSheet = parsed.sheetNames[0];
  return firstSheet ? parsed.sheetsByObjects[firstSheet] || [] : [];
}
