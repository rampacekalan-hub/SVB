import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    AuditModule,
    AuthModule,
    UsersModule,
    BuildingsModule,
    VotingModule,
    TicketsModule,
    DocumentsModule,
    AnnouncementsModule,
    EnergyModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
