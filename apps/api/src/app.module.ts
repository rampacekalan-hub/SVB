import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BuildingsModule } from './buildings/buildings.module';
import { VotingModule } from './voting/voting.module';
import { TicketsModule } from './tickets/tickets.module';
import { DocumentsModule } from './documents/documents.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { EnergyModule } from './energy/energy.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { FinanceModule } from './finance/finance.module';
import { MeetingsModule } from './meetings/meetings.module';
import { MailModule } from './mail/mail.module';
import { LeadsModule } from './leads/leads.module';
import { PushModule } from './push/push.module';
import { RevisionsModule } from './revisions/revisions.module';
import { ClassifiedsModule } from './classifieds/classifieds.module';
import { HealthModule } from './health/health.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { IncomingInvoicesModule } from './incoming-invoices/incoming-invoices.module';
import { PhonePairingModule } from './phone-pairing/phone-pairing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    MailModule,
    PushModule,
    AuditModule,
    AuthModule,
    UsersModule,
    BuildingsModule,
    VotingModule,
    TicketsModule,
    DocumentsModule,
    AnnouncementsModule,
    EnergyModule,
    FinanceModule,
    MeetingsModule,
    LeadsModule,
    RevisionsModule,
    ClassifiedsModule,
    HealthModule,
    SuppliersModule,
    IncomingInvoicesModule,
    PhonePairingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
