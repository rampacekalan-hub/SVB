import { Module } from '@nestjs/common';
import { RevisionsController } from './revisions.controller';
import { RevisionsService } from './revisions.service';
import { RevisionReminderService } from './revision-reminder.service';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [MailModule, PushModule],
  controllers: [RevisionsController],
  providers: [RevisionsService, RevisionReminderService],
})
export class RevisionsModule {}
