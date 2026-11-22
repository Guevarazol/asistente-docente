import mammoth from 'mammoth';
import { readSheet } from 'read-excel-file/browser';
import type { UploadedAttachment } from '../types/casm';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`No se pudo leer la imagen ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === ';') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/**
 * Compresses large mobile camera photos to keep upload fast and well within API limits
 */
async function compressImageIfNeeded(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  const dataUrl = await fileToDataUrl(file);
  if (file.size <= 1.2 * 1024 * 1024) {
    const commaIdx = dataUrl.indexOf(',');
    return {
      base64: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl,
      mimeType: file.type || 'image/jpeg',
      previewUrl: dataUrl,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1800;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const commaIdx = dataUrl.indexOf(',');
        resolve({
          base64: dataUrl.slice(commaIdx + 1),
          mimeType: file.type || 'image/jpeg',
          previewUrl: dataUrl,
        });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
      const commaIdx = compressedUrl.indexOf(',');
      resolve({
        base64: compressedUrl.slice(commaIdx + 1),
        mimeType: 'image/jpeg',
        previewUrl: compressedUrl,
      });
    };
    img.onerror = () => {
      const commaIdx = dataUrl.indexOf(',');
      resolve({
        base64: dataUrl.slice(commaIdx + 1),
        mimeType: file.type || 'image/jpeg',
        previewUrl: dataUrl,
      });
    };
    img.src = dataUrl;
  });
}

export async function parseUploadedFile(file: File): Promise<UploadedAttachment> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Images (including camera photos)
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
    const { base64, mimeType, previewUrl } = await compressImageIfNeeded(file);
    return {
      id,
      name: file.name || `Foto_${new Date().toLocaleTimeString('es-SV')}.jpg`,
      kind: 'image',
      mimeType,
      base64,
      previewUrl,
    };
  }

  // PDF -> sent directly to Gemini multimodal
  if (mime === 'application/pdf' || ext === 'pdf') {
    const base64 = await fileToBase64(file);
    return {
      id,
      name: file.name,
      kind: 'pdf',
      mimeType: 'application/pdf',
      base64,
    };
  }

  // DOCX -> mammoth.js
  if (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (!result.value.trim()) {
        throw new Error('El documento Word parece estar vacío o contiene solo imágenes incrustadas.');
      }
      return {
        id,
        name: file.name,
        kind: 'text',
        mimeType: 'text/plain',
        extractedText: result.value.trim(),
      };
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `No se pudo leer el archivo DOCX "${file.name}": ${err.message}`
          : `Archivo DOCX "${file.name}" ilegible.`
      );
    }
  }

  // XLSX -> read-excel-file
  if (ext === 'xlsx' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    try {
      const rows = await readSheet(file);
      const csvLines = rows
        .map((row) => row.map((cell) => String(cell ?? '').trim()).join(', '))
        .filter((line) => line.replace(/,/g, '').trim().length > 0);
      if (csvLines.length === 0) {
        throw new Error('La hoja de cálculo no contiene datos legibles.');
      }
      return {
        id,
        name: file.name,
        kind: 'text',
        mimeType: 'text/csv',
        extractedText: csvLines.join('\n'),
      };
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `No se pudo leer el archivo Excel "${file.name}": ${err.message}`
          : `Hoja de cálculo "${file.name}" ilegible.`
      );
    }
  }

  // CSV -> native parser
  if (ext === 'csv' || mime === 'text/csv') {
    const text = await file.text();
    if (!text.trim()) {
      throw new Error(`El archivo CSV "${file.name}" está vacío.`);
    }
    return {
      id,
      name: file.name,
      kind: 'text',
      mimeType: 'text/csv',
      extractedText: text.trim(),
    };
  }

  // TXT / MD / JSON
  if (['txt', 'md', 'json'].includes(ext) || mime.startsWith('text/')) {
    const text = await file.text();
    if (!text.trim()) {
      throw new Error(`El archivo de texto "${file.name}" está vacío.`);
    }
    return {
      id,
      name: file.name,
      kind: 'text',
      mimeType: 'text/plain',
      extractedText: text.trim(),
    };
  }

  throw new Error(
    `Formato no compatible (${file.name}). Usa PDF, imágenes/fotos, DOCX, XLSX, CSV o TXT.`
  );
}

/**
 * Extracts student names directly from an Excel (.xlsx) or CSV file for the Diplomas module
 */
export async function parseNamesFromSpreadsheet(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let rows: unknown[][];

  if (ext === 'csv' || file.type === 'text/csv') {
    rows = parseCsvRows(await file.text());
  } else {
    rows = await readSheet(file);
  }

  const names: string[] = [];
  const headerWords = ['nombre', 'estudiante', 'alumno', 'graduando', 'n°', 'no.', '#', 'grado', 'seccion'];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const textCells = row
      .map((cell) => String(cell ?? '').trim())
      .filter((c) => c.length >= 2 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(c));
    if (textCells.length === 0) continue;

    const joinedLower = textCells.join(' ').toLowerCase();
    if (headerWords.some((h) => textCells[0].toLowerCase() === h || joinedLower.startsWith('nombre'))) {
      continue;
    }

    const candidate =
      textCells.length >= 2 &&
      textCells[0].split(' ').length <= 3 &&
      textCells[1].split(' ').length <= 3
        ? `${textCells[0]} ${textCells[1]}`
        : textCells[0];
    if (candidate.length >= 4) {
      names.push(candidate.replace(/\s+/g, ' ').trim());
    }
  }
  return names;
}

export function fileToImageDataUrl(file: File): Promise<string> {
  return fileToDataUrl(file);
}
