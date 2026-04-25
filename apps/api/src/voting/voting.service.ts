import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { VoteChannel, VoteChoice, VotingStatus, VotingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VotingTallyService } from './voting-tally.service';
import { VotingPdfService } from './voting-pdf.service';
import { XadesService } from './xades.service';
import { StorageService } from '../storage/storage.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }>;
  mfa: boolean;
}

@Injectable()
export class VotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tally: VotingTallyService,
    private readonly pdf: VotingPdfService,
    private readonly xades: XadesService,
    private readonly storage: StorageService,
  ) {}

  async create(
    user: AuthedUser,
    input: {
      buildingId: string;
      title: string;
      description: string;
      type: VotingType;
      opensAt: Date;
      closesAt: Date;
      quorumRequired: string;
      meetingId?: string;
    },
  ) {
    this.assertRoleInBuilding(user, input.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (input.closesAt <= input.opensAt) {
      throw new BadRequestException('closesAt musí byť po opensAt.');
    }
    if (input.meetingId) {
      const m = await this.prisma.meeting.findUnique({ where: { id: input.meetingId } });
      if (!m || m.buildingId !== input.buildingId) {
        throw new BadRequestException('Schôdza nepatrí k tejto budove.');
      }
    }
    const voting = await this.prisma.voting.create({
      data: {
        buildingId: input.buildingId,
        meetingId: input.meetingId,
        title: input.title,
        description: input.description,
        type: input.type,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        quorumRequired: input.quorumRequired,
        status: 'DRAFT',
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VOTING_CREATED',
      resourceType: 'Voting',
      resourceId: voting.id,
      payload: { title: voting.title },
    });
    return voting;
  }

  async open(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUniqueOrThrow({ where: { id: votingId } });
    this.assertRoleInBuilding(user, voting.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (voting.status !== 'DRAFT') {
      throw new BadRequestException('Otvoriť sa dá len voľba v stave DRAFT.');
    }
    const updated = await this.prisma.voting.update({
      where: { id: votingId },
      data: { status: 'OPEN' },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VOTING_OPENED',
      resourceType: 'Voting',
      resourceId: votingId,
    });
    return updated;
  }

  async castElectronic(
    user: AuthedUser,
    input: { votingId: string; apartmentId: string; choice: VoteChoice; sessionFingerprint: string },
  ) {
    if (!user.mfa) {
      throw new ForbiddenException('Elektronické hlasovanie vyžaduje 2FA prihlásenie.');
    }
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: input.votingId },
    });
    if (voting.status !== 'OPEN') {
      throw new BadRequestException('Hlasovanie nie je otvorené.');
    }
    const now = new Date();
    if (now < voting.opensAt || now > voting.closesAt) {
      throw new BadRequestException('Hlasovanie mimo časového okna.');
    }

    this.assertOwnsApartment(user, voting.buildingId, input.apartmentId);

    // Anti-replay: jedna session jeden záznam.
    const sessionHash = createHash('sha256')
      .update(`${user.id}|${input.votingId}|${input.apartmentId}|${input.sessionFingerprint}`)
      .digest('hex');

    const existing = await this.prisma.voteRecord.findFirst({
      where: { votingId: input.votingId, electronicSessionHash: sessionHash },
    });
    if (existing) {
      return existing;
    }

    return this.createVoteRecord({
      votingId: input.votingId,
      apartmentId: input.apartmentId,
      channel: 'ELECTRONIC',
      choice: input.choice,
      electronicSessionHash: sessionHash,
      recordedById: user.id,
    });
  }

  async castPaper(
    user: AuthedUser,
    input: {
      votingId: string;
      apartmentId: string;
      choice: VoteChoice;
      paperBallotReference: string;
      castAt?: Date;
      proxyFromApartmentId?: string;
      proxyDocumentKey?: string;
    },
  ) {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: input.votingId },
    });
    this.assertRoleInBuilding(user, voting.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (voting.status !== 'OPEN' && voting.status !== 'CLOSED') {
      throw new BadRequestException('Listinné hlasy sa pridávajú len počas / po skončení voľby.');
    }
    // Ak je proxy, cieľový byt (apartmentId) je priestor, ktorý hlasovanie ZAZNAMENÁVA
    // za zdrojový byt (proxyFromApartmentId). Hlas sa započíta za proxyFromApartmentId —
    // preto v tally logike vážime podľa proxyFromApartmentId.ownershipShare.
    if (input.proxyFromApartmentId) {
      const src = await this.prisma.apartment.findUnique({
        where: { id: input.proxyFromApartmentId },
      });
      if (!src || src.buildingId !== voting.buildingId) {
        throw new BadRequestException('Zdrojový byt splnomocnenia nepatrí do budovy.');
      }
      if (input.proxyFromApartmentId === input.apartmentId) {
        throw new BadRequestException('Splnomocnenie nemôže byť voči samému sebe.');
      }
    }
    return this.createVoteRecord({
      votingId: input.votingId,
      // Pre účely tally pracujeme so zdrojovým apartmentId (tým, za ktorý sa hlasuje)
      apartmentId: input.proxyFromApartmentId ?? input.apartmentId,
      channel: 'PAPER',
      choice: input.choice,
      paperBallotReference: input.paperBallotReference,
      recordedById: user.id,
      castAt: input.castAt,
      proxyFromApartmentId: input.proxyFromApartmentId,
      proxyDocumentKey: input.proxyDocumentKey,
    });
  }

  async close(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: votingId },
      include: { result: true },
    });
    this.assertRoleInBuilding(user, voting.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    return this.finalize(votingId, user.id);
  }

  /**
   * Automatické uzavretie scheduler-om po uplynutí closesAt.
   * Nevyžaduje oprávneného používateľa — beží zo systémového kontextu.
   */
  async closeBySystem(votingId: string) {
    return this.finalize(votingId, null);
  }

  private async finalize(votingId: string, actorId: string | null) {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: votingId },
      include: { result: true },
    });
    if (voting.status === 'CLOSED' || voting.status === 'CANCELLED') {
      throw new BadRequestException('Hlasovanie je už uzavreté.');
    }

    const outcome = await this.tally.tally(votingId);
    const pdfBuffer = await this.pdf.generate(votingId, outcome);
    const storageKey = `voting/${votingId}/zapisnica.pdf`;
    const { sha256 } = await this.storage.put(storageKey, pdfBuffer, 'application/pdf');

    // XAdES-BES detached signature vedľa PDF. Ak zlyhá (chýba cert), logujeme
    // a pokračujeme — PDF ostane nepodpísané, ale hlasovanie sa uzavrie.
    try {
      const votingFull = await this.prisma.voting.findUniqueOrThrow({
        where: { id: votingId },
        include: { building: { select: { name: true } } },
      });
      const actor = actorId
        ? await this.prisma.user.findUnique({ where: { id: actorId } })
        : null;
      const signerName = actor ? `${actor.firstName} ${actor.lastName}` : 'SYSTEM';
      const { xml, signatureSha256 } = await this.xades.signPdf(pdfBuffer, {
        votingId,
        votingTitle: votingFull.title,
        buildingName: votingFull.building.name,
        signerName,
        signerRole: actorId ? 'SVB_CHAIRMAN' : 'SYSTEM_AUTO_CLOSE',
      });
      await this.storage.put(
        `voting/${votingId}/zapisnica.xades.xml`,
        Buffer.from(xml, 'utf8'),
        'application/xml',
      );
      await this.audit.record({
        actorId: actorId ?? undefined,
        action: 'VOTING_XADES_SIGNED',
        resourceType: 'Voting',
        resourceId: votingId,
        payload: { signatureSha256, pdfSha256: sha256 },
      });
    } catch (err) {
      // XAdES nesmie blokovať uzavretie hlasovania.
      // eslint-disable-next-line no-console
      console.warn(`[VOTING] XAdES signature failed: ${(err as Error).message}`);
    }

    const [, result] = await this.prisma.$transaction([
      this.prisma.voting.update({
        where: { id: votingId },
        data: { status: 'CLOSED' as VotingStatus },
      }),
      this.prisma.votingResult.upsert({
        where: { votingId },
        create: {
          votingId,
          yesShares: outcome.yesShares.toString(),
          noShares: outcome.noShares.toString(),
          abstainShares: outcome.abstainShares.toString(),
          totalShares: outcome.totalShares.toString(),
          quorumReached: outcome.quorumReached,
          accepted: outcome.accepted,
          pdfStorageKey: storageKey,
          pdfSha256: sha256,
        },
        update: {
          yesShares: outcome.yesShares.toString(),
          noShares: outcome.noShares.toString(),
          abstainShares: outcome.abstainShares.toString(),
          totalShares: outcome.totalShares.toString(),
          quorumReached: outcome.quorumReached,
          accepted: outcome.accepted,
          pdfStorageKey: storageKey,
          pdfSha256: sha256,
        },
      }),
    ]);

    await this.audit.record({
      actorId: actorId ?? undefined,
      action: actorId ? 'VOTING_CLOSED' : 'VOTING_AUTO_CLOSED',
      resourceType: 'Voting',
      resourceId: votingId,
      payload: {
        accepted: outcome.accepted,
        quorumReached: outcome.quorumReached,
        pdfSha256: sha256,
      },
    });

    return { result, outcome };
  }

  async listForBuilding(user: AuthedUser, buildingId: string) {
    this.assertInBuilding(user, buildingId);
    return this.prisma.voting.findMany({
      where: { buildingId },
      include: { result: true },
      orderBy: { closesAt: 'desc' },
    });
  }

  async getMinutesDownloadUrl(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: { result: true },
    });
    if (!voting) throw new NotFoundException();
    this.assertInBuilding(user, voting.buildingId);
    if (!voting.result?.pdfStorageKey) {
      return { url: null, error: 'PDF zápisnica ešte nebola vygenerovaná. Najprv hlasovanie uzavrite.' };
    }
    const url = await this.storage.getPresignedUrl(voting.result.pdfStorageKey, 600);
    return { url, sha256: voting.result.pdfSha256 };
  }

  async getDetail(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: {
        result: true,
        records: {
          include: { apartment: { select: { id: true, unitNumber: true } } },
          orderBy: { castAt: 'desc' },
        },
        building: {
          include: {
            apartments: {
              select: { id: true, unitNumber: true, ownershipShare: true },
              orderBy: { unitNumber: 'asc' },
            },
          },
        },
      },
    });
    if (!voting) throw new NotFoundException();
    this.assertInBuilding(user, voting.buildingId);

    // Live tally — aj počas OPEN status-u, aby predseda + vlastníci videli priebežné výsledky
    let liveTally = null;
    if (!voting.result) {
      try {
        liveTally = await this.tally.tally(votingId);
      } catch {
        // Tally môže zlyhať pre nedostatočné dáta — ignorujeme, vrátime null
      }
    }

    // Zoznam apartmentov ktoré ešte nehlasovali (pre predsedu — koho upozorniť)
    const votedApartmentIds = new Set(voting.records.map((r) => r.apartmentId));
    const notVotedApartments = voting.building.apartments.filter(
      (a) => !votedApartmentIds.has(a.id),
    );

    return { ...voting, liveTally, notVotedApartments };
  }

  private async createVoteRecord(input: {
    votingId: string;
    apartmentId: string;
    channel: VoteChannel;
    choice: VoteChoice;
    electronicSessionHash?: string;
    paperBallotReference?: string;
    recordedById?: string;
    castAt?: Date;
    proxyFromApartmentId?: string;
    proxyDocumentKey?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.voteRecord.findFirst({
        where: { votingId: input.votingId },
        orderBy: { castAt: 'desc' },
        select: { integrityHash: true },
      });
      const prevHash = last?.integrityHash ?? null;
      const castAt = input.castAt ?? new Date();
      const material = JSON.stringify({
        prevHash,
        votingId: input.votingId,
        apartmentId: input.apartmentId,
        channel: input.channel,
        choice: input.choice,
        castAt: castAt.toISOString(),
      });
      const integrityHash = createHash('sha256').update(material).digest('hex');

      const record = await tx.voteRecord.create({
        data: {
          proxyFromApartmentId: input.proxyFromApartmentId,
          proxyDocumentKey: input.proxyDocumentKey,
          votingId: input.votingId,
          apartmentId: input.apartmentId,
          channel: input.channel,
          choice: input.choice,
          castAt,
          electronicSessionHash: input.electronicSessionHash,
          paperBallotReference: input.paperBallotReference,
          recordedById: input.recordedById,
          integrityHash,
          prevHash,
        },
      });

      return record;
    });
  }

  private assertInBuilding(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some((m) => m.buildingId === buildingId);
    if (!ok) throw new ForbiddenException('Nemáte prístup k tejto budove.');
  }

  private assertRoleInBuilding(user: AuthedUser, buildingId: string, roles: string[]) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && roles.includes(m.role),
    );
    if (!ok) throw new ForbiddenException('Nedostatočné oprávnenia v tejto budove.');
  }

  private assertOwnsApartment(user: AuthedUser, buildingId: string, apartmentId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && m.apartmentId === apartmentId && m.role === 'OWNER',
    );
    if (!ok) throw new ForbiddenException('Nie ste vlastníkom tohto bytu.');
  }
}
