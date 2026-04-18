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
    },
  ) {
    this.assertRoleInBuilding(user, input.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (input.closesAt <= input.opensAt) {
      throw new BadRequestException('closesAt musí byť po opensAt.');
    }
    const voting = await this.prisma.voting.create({
      data: {
        buildingId: input.buildingId,
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
    },
  ) {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: input.votingId },
    });
    this.assertRoleInBuilding(user, voting.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (voting.status !== 'OPEN' && voting.status !== 'CLOSED') {
      throw new BadRequestException('Listinné hlasy sa pridávajú len počas / po skončení voľby.');
    }
    return this.createVoteRecord({
      votingId: input.votingId,
      apartmentId: input.apartmentId,
      channel: 'PAPER',
      choice: input.choice,
      paperBallotReference: input.paperBallotReference,
      recordedById: user.id,
      castAt: input.castAt,
    });
  }

  async close(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: votingId },
      include: { result: true },
    });
    this.assertRoleInBuilding(user, voting.buildingId, ['CHAIRMAN', 'MANAGER', 'ADMIN']);
    if (voting.status === 'CLOSED' || voting.status === 'CANCELLED') {
      throw new BadRequestException('Hlasovanie je už uzavreté.');
    }

    const outcome = await this.tally.tally(votingId);
    const pdfBuffer = await this.pdf.generate(votingId, outcome);
    const storageKey = `voting/${votingId}/zapisnica.pdf`;
    const { sha256 } = await this.storage.put(storageKey, pdfBuffer, 'application/pdf');

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
      actorId: user.id,
      action: 'VOTING_CLOSED',
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

  async getDetail(user: AuthedUser, votingId: string) {
    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: { result: true, records: true, building: true },
    });
    if (!voting) throw new NotFoundException();
    this.assertInBuilding(user, voting.buildingId);
    return voting;
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
