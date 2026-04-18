import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    user: AuthedUser,
    input: {
      buildingId: string;
      category: DocumentCategory;
      title: string;
      description?: string;
      validFrom?: Date;
      validTo?: Date;
      file: { buffer: Buffer; mimeType: string };
    },
  ) {
    const canUpload = user.memberships.some(
      (m) =>
        m.buildingId === input.buildingId &&
        ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!canUpload) throw new ForbiddenException();

    const key = `documents/${input.buildingId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { sha256, size } = await this.storage.put(key, input.file.buffer, input.file.mimeType);

    const doc = await this.prisma.document.create({
      data: {
        buildingId: input.buildingId,
        category: input.category,
        title: input.title,
        description: input.description,
        storageKey: key,
        mimeType: input.file.mimeType,
        sizeBytes: size,
        sha256,
        uploadedBy: user.id,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'Document',
      resourceId: doc.id,
      payload: { title: doc.title, category: doc.category, sha256 },
    });
    return doc;
  }

  async list(user: AuthedUser, buildingId: string, category?: DocumentCategory) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
    return this.prisma.document.findMany({
      where: { buildingId, category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async download(user: AuthedUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    if (!user.memberships.some((m) => m.buildingId === doc.buildingId)) {
      throw new ForbiddenException();
    }
    const url = await this.storage.getPresignedUrl(doc.storageKey, 600);
    await this.audit.record({
      actorId: user.id,
      action: 'DOCUMENT_DOWNLOADED',
      resourceType: 'Document',
      resourceId: id,
    });
    return { url, expiresInSeconds: 600, sha256: doc.sha256 };
  }
}
