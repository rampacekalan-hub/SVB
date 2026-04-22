import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface CodeRow {
  unitNumber: string;
  floor: number | null;
  activationCode: string;
}

/**
 * Vygeneruje PDF zoznam aktivačných kódov na tlač a distribúciu
 * do poštových schránok vlastníkov.
 */
@Injectable()
export class ActivationCodesPdfService {
  async generate(buildingName: string, rows: CodeRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('DomovPlus — Aktivačné kódy', { align: 'left' });
      doc.moveDown(0.2);
      doc.fontSize(12).fillColor('#555').text(buildingName);
      doc.moveDown(0.5);
      doc.fillColor('#000').fontSize(10).text(
        'Každý vlastník si zaregistruje svoj účet na adrese https://domovplus.sk/registracia. ' +
          'Pri registrácii zadá nižšie uvedený kód — platí jednorazovo pre byt, ku ktorému je priradený.',
        { width: 495 },
      );
      doc.moveDown(1);

      // Hlavička tabuľky
      const tableTop = doc.y;
      doc.fontSize(11).fillColor('#111');
      doc.text('Byt', 50, tableTop, { width: 80, continued: false });
      doc.text('Poschodie', 130, tableTop, { width: 100 });
      doc.text('Aktivačný kód', 230, tableTop, { width: 250 });
      doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#888').stroke();

      let y = tableTop + 22;
      for (const r of rows) {
        if (y > 780) {
          doc.addPage();
          y = 50;
        }
        doc.fontSize(11).fillColor('#000').text(r.unitNumber, 50, y, { width: 80 });
        doc.text(r.floor === null ? '—' : String(r.floor), 130, y, { width: 100 });
        doc.font('Courier').fontSize(12).text(r.activationCode, 230, y, { width: 250 });
        doc.font('Helvetica');
        y += 22;
      }

      doc.moveDown(3);
      doc
        .fontSize(9)
        .fillColor('#666')
        .text(
          `Vygenerované: ${new Date().toLocaleString('sk-SK')} · ` +
            'Uchovávajte kódy v tajnosti; po uplatnení strácajú platnosť.',
          50,
          doc.y,
          { width: 495 },
        );

      doc.end();
    });
  }
}
