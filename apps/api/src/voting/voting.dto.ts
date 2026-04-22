import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { VoteChoice, VotingType } from '@prisma/client';

export class CreateVotingDto {
  @IsString()
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

  // Voliteľne — previaže hlasovanie so schôdzou (bodom programu)
  @IsOptional()
  @IsString()
  meetingId?: string;
}

export class CastElectronicDto {
  @IsString()
  apartmentId!: string;

  @IsEnum(VoteChoice)
  choice!: VoteChoice;

  @IsString()
  sessionFingerprint!: string;
}

export class CastPaperDto {
  @IsString()
  apartmentId!: string;

  @IsEnum(VoteChoice)
  choice!: VoteChoice;

  @IsString()
  paperBallotReference!: string;

  @IsOptional()
  @IsDateString()
  castAt?: string;

  // Splnomocnenie: apartmentId vlastníka, ktorý dal splnomocnenie
  // tomuto apartmentu (proxyFromApartmentId je zdroj, apartmentId je cieľ/držiteľ).
  @IsOptional()
  @IsString()
  proxyFromApartmentId?: string;

  @IsOptional()
  @IsString()
  proxyDocumentKey?: string;
}
