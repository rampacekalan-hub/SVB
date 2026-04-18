import { Injectable } from '@nestjs/common';
import { Prisma, VoteChannel, VoteChoice, VotingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Decimal = Prisma.Decimal;

export interface TallyOutcome {
  yesShares: Decimal;
  noShares: Decimal;
  abstainShares: Decimal;
  totalShares: Decimal;
  totalBuildingShares: Decimal;
  quorumReached: boolean;
  accepted: boolean;
  effectiveVotes: Array<{
    apartmentId: string;
    channel: VoteChannel;
    choice: VoteChoice;
    castAt: Date;
    share: Decimal;
  }>;
}

/**
 * Právne pravidlá vyhodnotenia (SK 182/1993, ČR NOZ §1206+):
 *  1. Ak pre (votingId, apartmentId) existuje aspoň jeden LISTINNÝ hlas,
 *     započíta sa NAJNOVŠÍ listinný — listinný má prioritu pred elektronickým.
 *  2. Ak nie sú listinné, započíta sa NAJNOVŠÍ elektronický hlas pred closesAt.
 *  3. Hlas sa váži podielom bytu na spoločných častiach (ownershipShare).
 *  4. Kvórum = súčet všetkých hlasujúcich podielov / súčet podielov budovy.
 */
@Injectable()
export class VotingTallyService {
  constructor(private readonly prisma: PrismaService) {}

  async tally(votingId: string): Promise<TallyOutcome> {
    const voting = await this.prisma.voting.findUniqueOrThrow({
      where: { id: votingId },
      include: {
        records: { orderBy: { castAt: 'desc' } },
        building: {
          include: { apartments: { select: { id: true, ownershipShare: true } } },
        },
      },
    });

    const apartmentShare = new Map<string, Decimal>();
    let totalBuildingShares = new Prisma.Decimal(0);
    for (const a of voting.building.apartments) {
      apartmentShare.set(a.id, a.ownershipShare);
      totalBuildingShares = totalBuildingShares.plus(a.ownershipShare);
    }

    const validRecords = voting.records.filter((r) => r.castAt <= voting.closesAt);
    const effective = new Map<
      string,
      { apartmentId: string; channel: VoteChannel; choice: VoteChoice; castAt: Date }
    >();

    for (const rec of validRecords) {
      const current = effective.get(rec.apartmentId);
      if (!current) {
        effective.set(rec.apartmentId, rec);
        continue;
      }
      // PAPER > ELECTRONIC; pri rovnakom kanáli víťazí novší záznam.
      if (current.channel === 'PAPER' && rec.channel === 'ELECTRONIC') continue;
      if (current.channel === 'ELECTRONIC' && rec.channel === 'PAPER') {
        effective.set(rec.apartmentId, rec);
        continue;
      }
      if (rec.castAt > current.castAt) {
        effective.set(rec.apartmentId, rec);
      }
    }

    let yes = new Prisma.Decimal(0);
    let no = new Prisma.Decimal(0);
    let abstain = new Prisma.Decimal(0);
    const effectiveVotes: TallyOutcome['effectiveVotes'] = [];

    for (const vote of effective.values()) {
      const share = apartmentShare.get(vote.apartmentId) ?? new Prisma.Decimal(0);
      if (vote.choice === 'YES') yes = yes.plus(share);
      else if (vote.choice === 'NO') no = no.plus(share);
      else abstain = abstain.plus(share);
      effectiveVotes.push({ ...vote, share });
    }

    const total = yes.plus(no).plus(abstain);
    const quorumReached = totalBuildingShares.gt(0)
      ? total.dividedBy(totalBuildingShares).gte(voting.quorumRequired)
      : false;

    const accepted = quorumReached && acceptanceReached(voting.type, yes, total);

    return {
      yesShares: yes,
      noShares: no,
      abstainShares: abstain,
      totalShares: total,
      totalBuildingShares,
      quorumReached,
      accepted,
      effectiveVotes,
    };
  }
}

function acceptanceReached(type: VotingType, yes: Decimal, total: Decimal): boolean {
  if (total.lte(0)) return false;
  const ratio = yes.dividedBy(total);
  switch (type) {
    case 'SIMPLE_MAJORITY':
      return ratio.gt(new Prisma.Decimal('0.5'));
    case 'QUALIFIED_MAJORITY':
      return ratio.gte(new Prisma.Decimal('0.6666666666'));
    case 'UNANIMOUS':
      return ratio.equals(new Prisma.Decimal(1));
  }
}
