import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import type { TallyOutcome } from './voting-tally.service';

@Injectable()
export class VotingPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(votingId: string, outcome: TallyOutcome): Promise<Buffer> {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: votingId },
      include: { building: true },
    });

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Zápisnica z hlasovania', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Budova: ${voting.building.name}, ${voting.building.address}`);
      doc.text(`Právna forma: ${voting.building.legalForm ?? 'N/A'}`);
      doc.text(`Krajina: ${voting.building.country}`);
      doc.moveDown();

      doc.fontSize(14).text(voting.title);
      doc.fontSize(10).text(voting.description);
      doc.moveDown();
      doc.fontSize(10).text(`Typ: ${voting.type}`);
      doc.text(`Otvorené: ${voting.opensAt.toISOString()}`);
      doc.text(`Uzavreté: ${voting.closesAt.toISOString()}`);
      doc.text(`Požadované kvórum: ${voting.quorumRequired.toString()}`);
      doc.moveDown();

      doc.fontSize(14).text('Výsledok');
      doc.fontSize(10).text(`ÁNO (podiely): ${outcome.yesShares.toString()}`);
      doc.text(`NIE (podiely): ${outcome.noShares.toString()}`);
      doc.text(`ZDRŽAL SA (podiely): ${outcome.abstainShares.toString()}`);
      doc.text(`Spolu hlasovali: ${outcome.totalShares.toString()}`);
      doc.text(`Podiely budovy spolu: ${outcome.totalBuildingShares.toString()}`);
      doc.text(`Kvórum dosiahnuté: ${outcome.quorumReached ? 'ÁNO' : 'NIE'}`);
      doc.text(`Návrh prijatý: ${outcome.accepted ? 'ÁNO' : 'NIE'}`);
      doc.moveDown();

      doc.fontSize(14).text('Hlasy (efektívne započítané)');
      doc.fontSize(9);
      outcome.effectiveVotes.forEach((v) => {
        doc.text(
          `- byt=${v.apartmentId.slice(0, 8)}… kanál=${v.channel} voľba=${v.choice} ` +
            `podiel=${v.share.toString()} čas=${v.castAt.toISOString()}`,
        );
      });

      doc.moveDown();
      doc.fontSize(8).text(
        'Táto zápisnica bola vygenerovaná automaticky systémom Floory. ' +
          'Záznamy hlasov sú hash-reťazené (SHA-256) pre overenie integrity. ' +
          'Pre právnu silu pripojte elektronický podpis (XAdES) podľa vnútorného procesu SVB/SVJ.',
        { align: 'justify' },
      );

      doc.end();
    });
  }
}
