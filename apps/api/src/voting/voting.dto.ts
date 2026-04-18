import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { VoteChoice, VotingType } from '@prisma/client';

export class CreateVotingDto {
  @IsUUID()
  buildingId!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(VotingType)
  type!: VotingType;

  @IsDateString()
  opensAt!: string;

  @IsDateString()
  closesAt!: string;

  // napr. "0.5001" pre nadpolovičnú väčšinu prítomných podielov
  @IsNumberString()
  quorumRequired!: string;
}

export class CastElectronicDto {
  @IsUUID()
  apartmentId!: string;

  @IsEnum(VoteChoice)
  choice!: VoteChoice;

  @IsString()
  sessionFingerprint!: string;
}

export class CastPaperDto {
  @IsUUID()
  apartmentId!: string;

  @IsEnum(VoteChoice)
  choice!: VoteChoice;

  @IsString()
  paperBallotReference!: string;

  @IsOptional()
  @IsDateString()
  castAt?: string;
}
