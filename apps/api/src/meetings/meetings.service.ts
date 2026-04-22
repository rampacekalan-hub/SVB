import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MeetingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }>;
}

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async create(
    user: AuthedUser,
    input: {
      buildingId: string;
      title: string;
      scheduledAt: Date;
      location?: string;
      agenda: string;
    },
  ) {
    this.assertAdmin(user, input.buildingId);
    const meeting = await this.prisma.meeting.create({
      data: {
        buildingId: input.buildingId,
        createdById: user.id,
        title: input.title,
        scheduledAt: input.scheduledAt,
        location: input.location,
        agenda: input.agenda,
        status: 'SCHEDULED',
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'MEETING_CREATED',
      resourceType: 'Meeting',
      resourceId: meeting.id,
      payload: { title: meeting.title, scheduledAt: meeting.scheduledAt },
    });
    return meeting;
  }

  async list(user: AuthedUser, buildingId: string) {
    this.assertMember(user, buildingId);
    return this.prisma.meeting.findMany({
      where: { buildingId },
      orderBy: { scheduledAt: 'desc' },
      include: { _count: { select: { attendance: true } } },
    });
  }

  async detail(user: AuthedUser, id: string) {
    const m = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        attendance: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!m) throw new NotFoundException();
    this.assertMember(user, m.buildingId);
    return m;
  }

  async rsvp(user: AuthedUser, meetingId: string, rsvp: 'YES' | 'NO' | 'MAYBE') {
    const m = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!m) throw new NotFoundException();
    this.assertMember(user, m.buildingId);
    const apartmentId =
      user.memberships.find((x) => x.buildingId === m.buildingId && x.apartmentId)?.apartmentId ??
      null;
    return this.prisma.meetingAttendance.upsert({
      where: { meetingId_userId: { meetingId, userId: user.id } },
      create: { meetingId, userId: user.id, apartmentId, rsvp },
      update: { rsvp },
    });
  }

  async updateStatus(user: AuthedUser, id: string, status: MeetingStatus, minutes?: string) {
    const m = await this.prisma.meeting.findUnique({ where: { id } });
    if (!m) throw new NotFoundException();
    this.assertAdmin(user, m.buildingId);
    return this.prisma.meeting.update({
      where: { id },
      data: { status, minutes: minutes ?? m.minutes },
    });
  }

  /**
   * Nahranie zápisnice v PDF + automatické označenie schôdze ako COMPLETED.
   * PDF sa uloží do MinIO pod kľúčom meetings/<id>/zapisnica.pdf.
   */
  async uploadMinutes(
    user: AuthedUser,
    id: string,
    file: { buffer: Buffer; mimeType: string },
    minutesText?: string,
  ) {
    const m = await this.prisma.meeting.findUnique({ where: { id } });
    if (!m) throw new NotFoundException();
    this.assertAdmin(user, m.buildingId);
    const key = `meetings/${id}/zapisnica.pdf`;
    await this.storage.put(key, file.buffer, file.mimeType);
    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        minutes: minutesText ?? m.minutes,
        minutesPdfKey: key,
        status: 'COMPLETED',
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'MEETING_MINUTES_UPLOADED',
      resourceType: 'Meeting',
      resourceId: id,
    });
    return updated;
  }

  async minutesDownloadUrl(user: AuthedUser, id: string) {
    const m = await this.prisma.meeting.findUnique({ where: { id } });
    if (!m) throw new NotFoundException();
    this.assertMember(user, m.buildingId);
    if (!m.minutesPdfKey) throw new NotFoundException('Zápisnica zatiaľ nie je nahraná.');
    const url = await this.storage.getPresignedUrl(m.minutesPdfKey, 600);
    return { url, expiresInSeconds: 600 };
  }

  private assertMember(user: AuthedUser, buildingId: string) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
  }
}
