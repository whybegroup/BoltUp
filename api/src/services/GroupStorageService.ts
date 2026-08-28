import { PrismaClient } from '@prisma/client';
import { extractUploadUrlsFromForumBody } from '../utils/groupPostBodyUploads';
import {
  DEFAULT_GROUP_MAX_STORAGE_BYTES,
  formatStorageBytes,
  groupStorageExceededMessage,
} from '../utils/groupStorageLimits';
import { httpError } from '../utils/httpError';
import {
  managedUploadByteSize,
  tryExtractUploadObjectKey,
} from '../utils/objectStorePaths';
import { getS3Config } from '../utils/s3Config';
import { NotificationService } from './NotificationService';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

export type GroupStorageRequestRow = {
  id: string;
  groupId: string;
  userId: string;
  requestedBytes: number;
  note?: string | null;
  status: 'pending' | 'approved' | 'denied';
  createdAt: Date;
  decidedAt?: Date | null;
};

export class GroupStorageService {
  public async getMaxStorageBytes(groupId: string): Promise<number> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { maxStorageBytes: true },
    });
    if (!group) return DEFAULT_GROUP_MAX_STORAGE_BYTES;
    return group.maxStorageBytes > 0 ? group.maxStorageBytes : DEFAULT_GROUP_MAX_STORAGE_BYTES;
  }

  public async trackedBytesForKey(objectKey: string): Promise<number> {
    const row = await prisma.groupStorageFile.findUnique({
      where: { objectKey },
      select: { byteSize: true },
    });
    return row?.byteSize ?? 0;
  }

  public async getUsedStorageBytes(groupId: string): Promise<number> {
    const [referenced, tracked] = await Promise.all([
      this.collectReferencedUploadUrls(groupId),
      prisma.groupStorageFile.findMany({
        where: { groupId },
        select: { objectKey: true, byteSize: true },
      }),
    ]);

    const sizes = new Map<string, number>();
    for (const row of tracked) {
      if (row.objectKey) sizes.set(row.objectKey, row.byteSize);
    }

    const cfg = getS3Config();
    for (const url of referenced) {
      const key = tryExtractUploadObjectKey(url, cfg);
      if (!key || sizes.has(key)) continue;
      const size = await managedUploadByteSize(url);
      if (size != null && size > 0) sizes.set(key, size);
    }

    let total = 0;
    for (const size of sizes.values()) total += size;
    return total;
  }

  public async assertCanAddBytes(groupId: string, userId: string | null, additionalBytes: number): Promise<void> {
    const extra = Math.max(0, Math.floor(additionalBytes));
    if (extra <= 0) return;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, maxStorageBytes: true, deletedAt: true },
    });

    if (group) {
      if (group.deletedAt) {
        throw httpError(404, 'Group not found');
      }
      if (userId) {
        const member = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          select: { status: true },
        });
        if (!member || member.status !== 'active') {
          throw httpError(403, 'Must be an active member to upload to this group');
        }
      }
    }

    const maxBytes = group
      ? group.maxStorageBytes > 0
        ? group.maxStorageBytes
        : DEFAULT_GROUP_MAX_STORAGE_BYTES
      : DEFAULT_GROUP_MAX_STORAGE_BYTES;
    const used = await this.getUsedStorageBytes(groupId);
    if (used + extra > maxBytes) {
      throw httpError(413, groupStorageExceededMessage(maxBytes));
    }
  }

  public async recordUpload(input: {
    groupId: string;
    objectKey: string;
    publicUrl: string;
    byteSize: number;
  }): Promise<void> {
    const byteSize = Math.max(0, Math.floor(input.byteSize));
    await prisma.groupStorageFile.upsert({
      where: { objectKey: input.objectKey },
      create: {
        groupId: input.groupId,
        objectKey: input.objectKey,
        publicUrl: input.publicUrl,
        byteSize,
      },
      update: {
        groupId: input.groupId,
        publicUrl: input.publicUrl,
        byteSize,
      },
    });
  }

  public async removeByObjectKey(objectKey: string): Promise<void> {
    try {
      await prisma.groupStorageFile.delete({ where: { objectKey } });
    } catch {
      /* already gone */
    }
  }

  public async removeByUrl(sourceUrl: string): Promise<void> {
    const key = tryExtractUploadObjectKey(sourceUrl, getS3Config());
    if (!key) return;
    await this.removeByObjectKey(key);
  }

  public async collectReferencedUploadUrls(groupId: string): Promise<string[]> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        thumbnail: true,
        coverPhotos: { select: { photoUrl: true } },
        events: {
          select: {
            coverPhotos: { select: { photoUrl: true } },
            comments: { select: { photos: { select: { photoUrl: true } } } },
          },
        },
        polls: { select: { photos: { select: { photoUrl: true } } } },
        posts: {
          select: {
            body: true,
            comments: { select: { body: true } },
          },
        },
      },
    });
    if (!group) return [];

    const urls = new Set<string>();
    const add = (raw: string | null | undefined) => {
      const u = raw?.trim();
      if (u) urls.add(u);
    };

    add(group.thumbnail);
    for (const p of group.coverPhotos) add(p.photoUrl);
    for (const ev of group.events) {
      for (const p of ev.coverPhotos) add(p.photoUrl);
      for (const c of ev.comments) {
        for (const p of c.photos) add(p.photoUrl);
      }
    }
    for (const poll of group.polls) {
      for (const p of poll.photos) add(p.photoUrl);
    }
    for (const post of group.posts) {
      for (const u of extractUploadUrlsFromForumBody(post.body)) add(u);
      for (const c of post.comments) {
        for (const u of extractUploadUrlsFromForumBody(c.body)) add(u);
      }
    }

    return [...urls];
  }

  public async collectAllManagedUrlsForPurge(groupId: string): Promise<string[]> {
    const [referenced, tracked] = await Promise.all([
      this.collectReferencedUploadUrls(groupId),
      prisma.groupStorageFile.findMany({
        where: { groupId },
        select: { publicUrl: true },
      }),
    ]);
    return [...new Set([...referenced, ...tracked.map((r) => r.publicUrl)].filter(Boolean))];
  }

  public usedExceedsMaxMessage(used: number): string {
    return `Uploaded files already use ${formatStorageBytes(used)}, which exceeds this group's storage limit.`;
  }

  public async deleteTrackingForGroup(groupId: string): Promise<void> {
    await prisma.groupStorageFile.deleteMany({ where: { groupId } });
    await prisma.groupStorageRequest.deleteMany({ where: { groupId } });
  }

  public mapRequest(row: {
    id: string;
    groupId: string;
    userId: string;
    requestedBytes: number;
    note: string | null;
    status: string;
    createdAt: Date;
    decidedAt: Date | null;
  }): GroupStorageRequestRow {
    const status =
      row.status === 'approved' || row.status === 'denied' ? row.status : 'pending';
    return {
      id: row.id,
      groupId: row.groupId,
      userId: row.userId,
      requestedBytes: row.requestedBytes,
      note: row.note,
      status,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
    };
  }

  public async getPendingRequest(groupId: string): Promise<GroupStorageRequestRow | null> {
    const row = await prisma.groupStorageRequest.findFirst({
      where: { groupId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.mapRequest(row) : null;
  }

  public async listRequests(groupId: string): Promise<GroupStorageRequestRow[]> {
    const rows = await prisma.groupStorageRequest.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.mapRequest(r));
  }

  public async createRequest(input: {
    groupId: string;
    userId: string;
    requestedBytes: number;
    note?: string;
  }): Promise<GroupStorageRequestRow> {
    const group = await prisma.group.findUnique({
      where: { id: input.groupId },
      select: { id: true, deletedAt: true, maxStorageBytes: true },
    });
    if (!group || group.deletedAt) {
      throw httpError(404, 'Group not found');
    }
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw httpError(403, 'Must be an active member to request more storage');
    }

    const requestedBytes = Math.floor(input.requestedBytes);
    if (!Number.isFinite(requestedBytes) || requestedBytes < DEFAULT_GROUP_MAX_STORAGE_BYTES) {
      throw httpError(400, 'Requested storage must be at least 1 GB');
    }
    if (requestedBytes <= group.maxStorageBytes) {
      throw httpError(400, 'Requested storage must be greater than the current group limit');
    }

    const existing = await prisma.groupStorageRequest.findFirst({
      where: { groupId: input.groupId, status: 'pending' },
    });
    if (existing) {
      throw httpError(409, 'This group already has a pending storage request');
    }

    const note = input.note?.trim() || null;
    const row = await prisma.groupStorageRequest.create({
      data: {
        groupId: input.groupId,
        userId: input.userId,
        requestedBytes,
        note,
      },
    });
    return this.mapRequest(row);
  }

  public async grantStorage(groupId: string, maxStorageBytes: number): Promise<void> {
    const cap = Math.floor(maxStorageBytes);
    if (!Number.isFinite(cap) || cap < 1) {
      throw httpError(400, 'maxStorageBytes must be at least 1');
    }
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, deletedAt: true },
    });
    if (!group || group.deletedAt) {
      throw httpError(404, 'Group not found');
    }

    await prisma.group.update({
      where: { id: groupId },
      data: { maxStorageBytes: cap },
    });

    await prisma.groupStorageRequest.updateMany({
      where: { groupId, status: 'pending', requestedBytes: { lte: cap } },
      data: { status: 'approved', decidedAt: new Date() },
    });

    const admins = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'active',
        role: { in: ['owner', 'admin'] },
      },
      select: { userId: true },
    });
    const ids = [...new Set(admins.map((m) => m.userId))];
    if (ids.length > 0) {
      await notificationService.createForUsers(
        ids,
        'Storage increased',
        `${group.name} can now store up to ${formatStorageBytes(cap)}.`,
        { type: 'group_storage', icon: 'cloud-outline', groupId, dest: 'group' }
      );
    }
  }

  public async listPendingRequestsForOperator(): Promise<
    Array<GroupStorageRequestRow & { groupName: string; currentMaxBytes: number; usedBytes: number }>
  > {
    const rows = await prisma.groupStorageRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    const out = [];
    for (const row of rows) {
      const group = await prisma.group.findUnique({
        where: { id: row.groupId },
        select: { name: true, maxStorageBytes: true, deletedAt: true },
      });
      if (!group || group.deletedAt) continue;
      const usedBytes = await this.getUsedStorageBytes(row.groupId);
      out.push({
        ...this.mapRequest(row),
        groupName: group.name,
        currentMaxBytes: group.maxStorageBytes,
        usedBytes,
      });
    }
    return out;
  }
}

export const groupStorage = new GroupStorageService();
