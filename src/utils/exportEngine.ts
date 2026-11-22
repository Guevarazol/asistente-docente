import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation as DocxPageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DiplomaBatchData, PageOrientation, PageSize, SchoolConfig } from '../types/casm';

export interface PdfExportOptions {
  orientation: PageOrientation;
  pageSize: PageSize;
  scale?: number;
}

function getPdfDimensionsMm(orientation: PageOrientation, pageSize: PageSize): [number, number] {
  // Letter: 215.9 x 279.4 mm | Oficio: 215.9 x 330.2 mm | Legal: 215.9 x 355.6 mm | A4: 210 x 297 mm
  let width = 215.9;
  let height = 279.4;
  if (pageSize === 'oficio') {
    height = 330.2;
  } else if (pageSize === 'legal') {
    height = 355.6;
  } else if (pageSize === 'a4') {
    width = 210.0;
    height = 297.0;
  }
  return orientation === 'landscape' ? [height, width] : [width, height];
}

/**
 * Renders an HTML preview container (or its explicit `.print-page` children) into a high-res PDF Blob
 * guaranteeing exact margins, page breaks, and page size (Letter Portrait, Letter Landscape, or Oficio 8.5x13).
 */
export async function renderElementToPdfBlob(
  container: HTMLElement,
  options: PdfExportOptions
): Promise<Blob> {
  const [pageW, pageH] = getPdfDimensionsMm(options.orientation, options.pageSize);
  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  });

  const explicitPages = Array.from(container.querySelectorAll<HTMLElement>('.print-page'));
  const targets = explicitPages.length > 0 ? explicitPages : [container];
  const scale = options.scale ?? (options.pageSize === 'oficio' ? 2.8 : 2.2);

  let isFirstPage = true;

  for (const target of targets) {
    const canvas = await html2canvas(target, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.96);
    const imgWidthMm = pageW;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (options.pageSize === 'oficio' || imgHeightMm <= pageH + 1.5) {
      if (!isFirstPage) pdf.addPage([pageW, pageH], options.orientation);
      isFirstPage = false;
      const drawHeight = Math.min(imgHeightMm, pageH);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, drawHeight, undefined, 'FAST');
    } else {
      // Multi-page vertical slicing for long letter documents
      let remainingHeight = imgHeightMm;
      let yOffset = 0;

      while (remainingHeight > 0.5) {
        if (!isFirstPage) pdf.addPage([pageW, pageH], options.orientation);
        isFirstPage = false;
        pdf.addImage(imgData, 'JPEG', 0, yOffset, imgWidthMm, imgHeightMm, undefined, 'FAST');
        remainingHeight -= pageH;
        yOffset -= pageH;
      }
    }
  }

  return pdf.output('blob');
}

export async function downloadPdfFromElement(
  container: HTMLElement,
  fileName: string,
  options: PdfExportOptions
): Promise<void> {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blob = await renderElementToPdfBlob(container, options);
  saveAs(blob, safeName);
}

/**
 * WhatsApp Share:
 * 1) On mobile browsers supporting Web Share Level 2 with files, share the PDF File directly.
 * 2) Otherwise download the PDF and open https://wa.me/?text=... cleanly.
 */
export async function sharePdfOnWhatsApp(
  container: HTMLElement,
  fileName: string,
  message: string,
  options: PdfExportOptions
): Promise<'shared_native' | 'fallback_download'> {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blob = await renderElementToPdfBlob(container, options);
  const file = new File([blob], safeName, { type: 'application/pdf' });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[]; text?: string; title?: string }) => boolean;
  };

  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: safeName.replace(/\.pdf$/i, ''),
          text: message,
        });
        return 'shared_native';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared_native';
      }
    }
  }

  // Fallback: download PDF and launch wa.me link via anchor element (avoids window.open blockers)
  saveAs(blob, safeName);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(
    `${message}\n\n(Adjunto el documento PDF: ${safeName})`
  )}`;
  const a = document.createElement('a');
  a.href = waUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return 'fallback_download';
}

/**
 * Injects dynamic @page size rule so browser print dialog matches preview orientation & size.
 */
export function triggerPrintDocument(orientation: PageOrientation, pageSize: PageSize): void {
  const styleId = 'casm-dynamic-print-page';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  let sizeCss = '8.5in 11in';
  if (pageSize === 'oficio') {
    sizeCss = orientation === 'landscape' ? '13in 8.5in' : '8.5in 13in';
  } else if (pageSize === 'legal') {
    sizeCss = orientation === 'landscape' ? '14in 8.5in' : '8.5in 14in';
  } else if (pageSize === 'a4') {
    sizeCss = orientation === 'landscape' ? '297mm 210mm' : '210mm 297mm';
  } else {
    sizeCss = orientation === 'landscape' ? '11in 8.5in' : '8.5in 11in';
  }
  styleEl.textContent = `@page { size: ${sizeCss}; margin: 0; }`;
  window.print();
}

/**
 * Renders each diploma node individually at high resolution into its own PDF and bundles all in a ZIP.
 */
export async function exportDiplomasBatchToZip(
  diplomaNodes: HTMLElement[],
  graduateNames: string[],
  zipFileName: string,
  onProgress?: (current: number, total: number) => void,
  options?: { orientation?: PageOrientation; pageSize?: PageSize; scale?: number }
): Promise<void> {
  const zip = new JSZip();
  const total = diplomaNodes.length;
  const orientation = options?.orientation || 'portrait';
  const pageSize = options?.pageSize || 'oficio';
  const scale = options?.scale ?? (pageSize === 'oficio' ? 2.8 : 2.4);

  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);
    const node = diplomaNodes[i];
    const studentName = (graduateNames[i] || `Graduando_${i + 1}`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    const blob = await renderElementToPdfBlob(node, {
      orientation,
      pageSize,
      scale,
    });
    zip.file(`${String(i + 1).padStart(2, '0')}_Diploma_${studentName}.pdf`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`);
}

/* ================= STRUCTURED WORD (.DOCX) GENERATOR ================= */

export interface DocxSectionBlock {
  heading?: string;
  paragraphs?: string[];
  keyValues?: Array<{ label: string; value: string }>;
  table?: {
    headers: string[];
    rows: string[][];
  };
  pageBreakBefore?: boolean;
}

export interface DocxDocumentSpec {
  schoolName: string;
  schoolSubtitle: string;
  title: string;
  subtitle?: string;
  orientation: PageOrientation;
  pageSize: PageSize;
  primaryHex?: string;
  accentHex?: string;
  sections: DocxSectionBlock[];
}

function cleanHex(hex: string | undefined, fallback: string): string {
  const value = (hex || fallback).replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

export async function downloadStructuredDocx(
  spec: DocxDocumentSpec,
  fileName: string
): Promise<void> {
  const primary = cleanHex(spec.primaryHex, '003366');
  const accent = cleanHex(spec.accentHex, 'FFA92D');

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: spec.schoolName.toUpperCase(),
          bold: true,
          size: 28,
          color: primary,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: accent },
      },
      children: [
        new TextRun({
          text: spec.schoolSubtitle,
          size: 18,
          color: '475569',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: spec.title,
          bold: true,
          size: 26,
          color: primary,
        }),
      ],
    }),
  ];

  if (spec.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: spec.subtitle,
            italics: true,
            size: 20,
            color: '334155',
          }),
        ],
      })
    );
  }

  for (const sec of spec.sections) {
    if (sec.heading) {
      children.push(
        new Paragraph({
          pageBreakBefore: sec.pageBreakBefore,
          spacing: { before: 200, after: 90 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: primary },
          },
          children: [
            new TextRun({
              text: sec.heading,
              bold: true,
              size: 22,
              color: primary,
            }),
          ],
        })
      );
    }

    if (sec.keyValues && sec.keyValues.length > 0) {
      const kvRows = sec.keyValues.map(
        (kv) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: kv.label, bold: true, size: 19, color: primary })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: kv.value || '[COMPLETAR]', size: 19 })],
                  }),
                ],
              }),
            ],
          })
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: kvRows,
        })
      );
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }

    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        if (!p) continue;
        children.push(
          new Paragraph({
            spacing: { after: 90 },
            children: [new TextRun({ text: p, size: 20 })],
          })
        );
      }
    }

    if (sec.table && sec.table.headers.length > 0) {
      const colWidth = Math.floor(100 / sec.table.headers.length);
      const headerRow = new TableRow({
        tableHeader: true,
        children: sec.table.headers.map(
          (h) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: primary },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })],
                }),
              ],
            })
        ),
      });

      const bodyRows = sec.table.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  width: { size: colWidth, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell || '', size: 18 })],
                    }),
                  ],
                })
            ),
          })
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...bodyRows],
        })
      );
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }
  }

  const pageWidthTwips = spec.pageSize === 'oficio' ? 12240 : 12240; // 8.5 in
  const pageHeightTwips = spec.pageSize === 'oficio' ? 18720 : 15840; // 13 in vs 11 in

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: spec.orientation === 'landscape' ? pageHeightTwips : pageWidthTwips,
              height: spec.orientation === 'landscape' ? pageWidthTwips : pageHeightTwips,
              orientation:
                spec.orientation === 'landscape'
                  ? DocxPageOrientation.LANDSCAPE
                  : DocxPageOrientation.PORTRAIT,
            },
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  saveAs(blob, safeName);
}

/* ================= EDITABLE WORD (.DOCX) DIPLOMAS GENERATOR ================= */

export async function downloadDiplomasDocx(
  config: SchoolConfig,
  batch: DiplomaBatchData,
  fileName: string
): Promise<void> {
  const primary = cleanHex(batch.primaryColor || config.primaryColor, '003366');
  const accent = cleanHex(batch.accentColor || config.accentColor, 'C89B3C');
  const orientation = batch.orientation || 'portrait';
  const pageSize = batch.pageSize || 'oficio';

  let pageWidthTwips = 12240; // 8.5in
  let pageHeightTwips = 15840; // 11in
  if (pageSize === 'oficio') {
    pageHeightTwips = 18720; // 13in
  } else if (pageSize === 'legal') {
    pageHeightTwips = 20160; // 14in
  } else if (pageSize === 'a4') {
    pageWidthTwips = 11906;
    pageHeightTwips = 16838;
  }

  const finalWidth = orientation === 'landscape' ? pageHeightTwips : pageWidthTwips;
  const finalHeight = orientation === 'landscape' ? pageWidthTwips : pageHeightTwips;

  const sections: any[] = [];

  for (let idx = 0; idx < batch.graduates.length; idx++) {
    const graduate = batch.graduates[idx];
    const renderedBody = batch.bodyTextTemplate
      .replace(/\[NIVEL\]/g, batch.nivelTexto)
      .replace(/\[FECHA EN LETRAS\]/g, batch.fechaEnLetras)
      .replace(/\[GRADO\]/g, batch.grado)
      .replace(/\[ALUMNO\]/g, graduate.fullName);

    const diplomaParagraphs: Paragraph[] = [];

    // Ministry Header
    if (batch.ministryHeader) {
      batch.ministryHeader.split('\n').forEach((line, i) => {
        diplomaParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: line.trim(),
                bold: true,
                size: i === 0 ? 20 : 16,
                color: primary,
              }),
            ],
          })
        );
      });
    }

    // Divider line
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 120 },
        children: [
          new TextRun({
            text: '═════════════════════════════════════════════',
            color: accent,
            size: 14,
          }),
        ],
      })
    );

    // School Name
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
        children: [
          new TextRun({
            text: config.schoolName.toUpperCase(),
            bold: true,
            size: orientation === 'landscape' ? 34 : 30,
            color: primary,
            font: 'Georgia',
          }),
        ],
      })
    );

    // Subtitle / City
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: (batch.institutionSubtitle || config.schoolCity).toUpperCase(),
            size: 16,
            color: '64748B',
            bold: true,
          }),
        ],
      })
    );

    // Diploma Title
    const titleText = batch.diplomaTitle || 'DIPLOMA';
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 100 },
        children: [
          new TextRun({
            text: titleText.toUpperCase(),
            bold: true,
            size: orientation === 'landscape' ? 38 : 34,
            color: accent,
            font: 'Georgia',
          }),
        ],
      })
    );

    // Intro Phrase
    const introText = batch.introPhrase || 'Por cuanto:';
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: introText,
            italics: true,
            size: 24,
            color: '475569',
            font: 'Georgia',
          }),
        ],
      })
    );

    // Graduate Name
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 160 },
        children: [
          new TextRun({
            text: graduate.fullName || '[COMPLETAR NOMBRE]',
            bold: true,
            size: orientation === 'landscape' ? 38 : 34,
            color: primary,
            font: 'Georgia',
          }),
        ],
      })
    );

    // Underline
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: '________________________________________________',
            bold: true,
            color: accent,
            size: 18,
          }),
        ],
      })
    );

    // Body Text
    diplomaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 100, after: 200, line: 340 },
        indent: { firstLine: 360 },
        children: [
          new TextRun({
            text: renderedBody,
            size: 22,
            color: '1E293B',
            font: 'Georgia',
          }),
        ],
      })
    );

    // Verse or Motto
    if (batch.verseOrMotto || config.verse) {
      diplomaParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 160 },
          children: [
            new TextRun({
              text: `«${batch.verseOrMotto || config.verse}»`,
              italics: true,
              size: 16,
              color: '475569',
              font: 'Georgia',
            }),
          ],
        })
      );
    }

    // Signatures in a 2-column table
    const sigTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [
                new Paragraph({ text: '', spacing: { after: 360 } }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 30 },
                  children: [
                    new TextRun({
                      text: '________________________________',
                      color: primary,
                      size: 18,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: batch.directoraNombre,
                      bold: true,
                      size: 18,
                      color: primary,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: batch.directoraCargo || 'Directora',
                      italics: true,
                      size: 16,
                      color: '64748B',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [new Paragraph({ text: '' })],
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [
                new Paragraph({ text: '', spacing: { after: 360 } }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 30 },
                  children: [
                    new TextRun({
                      text: '________________________________',
                      color: primary,
                      size: 18,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: batch.maestraGuiaNombre,
                      bold: true,
                      size: 18,
                      color: primary,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: batch.maestraGuiaCargo || `Maestra Guía · ${batch.grado}`,
                      italics: true,
                      size: 16,
                      color: '64748B',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    diplomaParagraphs.push(new Paragraph({ text: '', spacing: { before: 160 } }));

    // Decorative frame table wrapping the diploma page
    const frameTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.DOUBLE, size: 24, color: primary },
        bottom: { style: BorderStyle.DOUBLE, size: 24, color: primary },
        left: { style: BorderStyle.DOUBLE, size: 24, color: primary },
        right: { style: BorderStyle.DOUBLE, size: 24, color: primary },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: {
                top: 350,
                bottom: 350,
                left: 450,
                right: 450,
              },
              children: [...diplomaParagraphs, sigTable],
            }),
          ],
        }),
      ],
    });

    sections.push({
      properties: {
        page: {
          size: {
            width: finalWidth,
            height: finalHeight,
            orientation:
              orientation === 'landscape'
                ? DocxPageOrientation.LANDSCAPE
                : DocxPageOrientation.PORTRAIT,
          },
          margin: {
            top: 600,
            bottom: 600,
            left: 600,
            right: 600,
          },
        },
      },
      children: [frameTable],
    });
  }

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  const safeName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  saveAs(blob, safeName);
}
