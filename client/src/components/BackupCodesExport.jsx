import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

/**
 * BackupCodesExport Component
 * Provides PDF, DOCX, Print, and Copy functionality for 2FA backup codes
 */
export default function BackupCodesExport({ backupCodes, userEmail }) {
  const [copySuccess, setCopySuccess] = useState(false);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // ═══════════════════════════════════════
  // PDF EXPORT
  // ═══════════════════════════════════════
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Colors
    const primaryColor = [124, 58, 237]; // Purple
    const darkGray = [55, 65, 81];
    const lightGray = [107, 114, 128];

    // Header background
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo placeholder (robot emoji representation)
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('BotBuilder', pageWidth / 2, 20, { align: 'center' });

    // Subtitle
    doc.setFontSize(10);
    doc.text('AI-Powered Bot Platform', pageWidth / 2, 28, { align: 'center' });

    // Main title
    doc.setFontSize(18);
    doc.setTextColor(...darkGray);
    doc.text('Two-Factor Authentication', pageWidth / 2, 60, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Backup Codes', pageWidth / 2, 70, { align: 'center' });

    // Divider line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(40, 78, pageWidth - 40, 78);

    // Info section
    doc.setFontSize(10);
    doc.setTextColor(...lightGray);
    doc.text(`Generated on: ${currentDate}`, pageWidth / 2, 90, { align: 'center' });
    doc.text(`Account: ${userEmail}`, pageWidth / 2, 98, { align: 'center' });

    // Warning box
    doc.setFillColor(254, 243, 199); // Yellow background
    doc.roundedRect(20, 108, pageWidth - 40, 25, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(146, 64, 14); // Yellow-brown text
    doc.text('IMPORTANT: Keep these codes in a safe place!', pageWidth / 2, 118, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Each code can only be used once. Store them securely offline.', pageWidth / 2, 126, { align: 'center' });

    // Backup codes table
    const startY = 145;
    const cellWidth = 70;
    const cellHeight = 12;
    const startX = (pageWidth - (cellWidth * 2 + 10)) / 2;

    // Table header
    doc.setFillColor(243, 244, 246);
    doc.rect(startX, startY - 12, cellWidth * 2 + 10, 12, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...darkGray);
    doc.text('Your Backup Codes', pageWidth / 2, startY - 4, { align: 'center' });

    // Draw codes in 2 columns
    doc.setFontSize(12);
    doc.setFont('courier', 'normal');

    backupCodes.forEach((code, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + col * (cellWidth + 10);
      const y = startY + row * cellHeight;

      // Cell background
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, y, cellWidth, cellHeight - 2, 2, 2, 'F');

      // Code number
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightGray);
      doc.text(`${index + 1}.`, x + 4, y + 7);

      // Code value
      doc.setFontSize(11);
      doc.setFont('courier', 'bold');
      doc.setTextColor(...darkGray);
      doc.text(code, x + 15, y + 7);
    });

    // Footer instructions
    const footerY = startY + Math.ceil(backupCodes.length / 2) * cellHeight + 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);

    const instructions = [
      'How to use backup codes:',
      '1. When prompted for your 2FA code, click "Use backup code"',
      '2. Enter one of the unused codes above',
      '3. Each code can only be used once - cross it off after use',
      '',
      'If you run out of codes, generate new ones from Security Settings.'
    ];

    instructions.forEach((line, index) => {
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkGray);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightGray);
      }
      doc.text(line, 25, footerY + index * 6);
    });

    // Bottom border
    doc.setFillColor(124, 58, 237);
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageWidth, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('BotBuilder Security Document - Confidential', pageWidth / 2, doc.internal.pageSize.getHeight() - 4, { align: 'center' });

    // Save
    doc.save(`BotBuilder_2FA_Backup_Codes_${currentDate.replace(/\//g, '-')}.pdf`);
  };

  // ═══════════════════════════════════════
  // DOCX EXPORT
  // ═══════════════════════════════════════
  const downloadDOCX = async () => {
    // Create table rows for backup codes (2 columns)
    const tableRows = [];

    // Header row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '#', bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E5E7EB' },
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: 'Backup Code', bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E5E7EB' },
            width: { size: 40, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '#', bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E5E7EB' },
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: 'Backup Code', bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: 'E5E7EB' },
            width: { size: 40, type: WidthType.PERCENTAGE }
          })
        ]
      })
    );

    // Data rows (2 codes per row)
    for (let i = 0; i < backupCodes.length; i += 2) {
      const row = new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: `${i + 1}` })],
              alignment: AlignmentType.CENTER
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: backupCodes[i], font: 'Courier New', bold: true })],
              alignment: AlignmentType.CENTER
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: backupCodes[i + 1] ? `${i + 2}` : '' })],
              alignment: AlignmentType.CENTER
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: backupCodes[i + 1] || '', font: 'Courier New', bold: true })],
              alignment: AlignmentType.CENTER
            })]
          })
        ]
      });
      tableRows.push(row);
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            children: [new TextRun({ text: 'BotBuilder', bold: true, size: 36, color: '7C3AED' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [new TextRun({ text: 'AI-Powered Bot Platform', italics: true, size: 20, color: '6B7280' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // Title
          new Paragraph({
            text: 'Two-Factor Authentication Backup Codes',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),

          // Info
          new Paragraph({
            children: [new TextRun({ text: `Generated on: ${currentDate}`, size: 20, color: '6B7280' })],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            children: [new TextRun({ text: `Account: ${userEmail}`, size: 20, color: '6B7280' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // Warning
          new Paragraph({
            children: [
              new TextRun({ text: 'IMPORTANT: ', bold: true, color: 'B45309' }),
              new TextRun({ text: 'Keep these codes in a safe place! Each code can only be used once.', color: 'B45309' })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // Table
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),

          // Instructions
          new Paragraph({
            spacing: { before: 400 }
          }),
          new Paragraph({
            children: [new TextRun({ text: 'How to use backup codes:', bold: true })],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [new TextRun({ text: '1. When prompted for your 2FA code, click "Use backup code"' })],
            bullet: { level: 0 }
          }),
          new Paragraph({
            children: [new TextRun({ text: '2. Enter one of the unused codes from the table above' })],
            bullet: { level: 0 }
          }),
          new Paragraph({
            children: [new TextRun({ text: '3. Each code can only be used once - cross it off after use' })],
            bullet: { level: 0 }
          }),
          new Paragraph({
            children: [new TextRun({ text: '4. If you run out of codes, generate new ones from Security Settings' })],
            bullet: { level: 0 },
            spacing: { after: 400 }
          }),

          // Footer
          new Paragraph({
            children: [new TextRun({ text: 'BotBuilder Security Document - Confidential', size: 16, color: '9CA3AF', italics: true })],
            alignment: AlignmentType.CENTER
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `BotBuilder_2FA_Backup_Codes_${currentDate.replace(/\//g, '-')}.docx`);
  };

  // ═══════════════════════════════════════
  // PRINT
  // ═══════════════════════════════════════
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const codesHTML = backupCodes.map((code, index) =>
      `<div class="code-item">
        <span class="code-number">${index + 1}.</span>
        <span class="code-value">${code}</span>
        <span class="checkbox">[ ]</span>
      </div>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BotBuilder - 2FA Backup Codes</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #7C3AED;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #7C3AED;
          }
          .subtitle {
            color: #6B7280;
            font-size: 12px;
            margin-top: 5px;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            color: #1F2937;
            margin: 20px 0 10px;
            text-align: center;
          }
          .info {
            text-align: center;
            color: #6B7280;
            font-size: 12px;
            margin-bottom: 20px;
          }
          .warning {
            background: #FEF3C7;
            border: 1px solid #F59E0B;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 25px;
            text-align: center;
          }
          .warning-text {
            color: #92400E;
            font-weight: 600;
            font-size: 13px;
          }
          .codes-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 30px;
          }
          .code-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
          }
          .code-number {
            color: #9CA3AF;
            font-size: 12px;
            min-width: 20px;
          }
          .code-value {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 14px;
            flex: 1;
          }
          .checkbox {
            color: #D1D5DB;
            font-size: 14px;
          }
          .instructions {
            background: #F3F4F6;
            padding: 15px;
            border-radius: 8px;
            font-size: 12px;
          }
          .instructions h4 {
            margin-bottom: 10px;
            color: #374151;
          }
          .instructions ul {
            margin-left: 20px;
            color: #6B7280;
          }
          .instructions li {
            margin-bottom: 5px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #E5E7EB;
            text-align: center;
            font-size: 10px;
            color: #9CA3AF;
          }
          .cut-line {
            border-top: 2px dashed #D1D5DB;
            margin: 30px 0;
            position: relative;
          }
          .cut-line::before {
            content: 'CUT HERE';
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 0 10px;
            font-size: 10px;
            color: #9CA3AF;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">BotBuilder</div>
          <div class="subtitle">AI-Powered Bot Platform</div>
        </div>

        <div class="title">Two-Factor Authentication Backup Codes</div>

        <div class="info">
          Generated on: ${currentDate}<br>
          Account: ${userEmail}
        </div>

        <div class="warning">
          <div class="warning-text">
            IMPORTANT: Keep these codes in a safe place!<br>
            Each code can only be used once.
          </div>
        </div>

        <div class="codes-container">
          ${codesHTML}
        </div>

        <div class="instructions">
          <h4>How to use backup codes:</h4>
          <ul>
            <li>When prompted for your 2FA code, click "Use backup code"</li>
            <li>Enter one of the unused codes from above</li>
            <li>Check the box [ ] after using each code</li>
            <li>Generate new codes when you run out</li>
          </ul>
        </div>

        <div class="cut-line"></div>

        <div class="footer">
          BotBuilder Security Document - Confidential<br>
          This document contains sensitive authentication information. Store securely.
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // ═══════════════════════════════════════
  // COPY ALL
  // ═══════════════════════════════════════
  const copyAllCodes = async () => {
    const text = `BotBuilder - 2FA Backup Codes
Generated: ${currentDate}
Account: ${userEmail}

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Keep these codes safe! Each code can only be used once.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800">
      <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3 font-medium">
        Export your backup codes:
      </p>
      <div className="flex flex-wrap gap-2">
        {/* PDF Button */}
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          PDF
        </button>

        {/* DOCX Button */}
        <button
          onClick={downloadDOCX}
          className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
          </svg>
          DOCX
        </button>

        {/* Print Button */}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>

        {/* Copy Button */}
        <button
          onClick={copyAllCodes}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
            copySuccess
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }`}
        >
          {copySuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy All
            </>
          )}
        </button>
      </div>
    </div>
  );
}
