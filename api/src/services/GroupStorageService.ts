import { PrismaClient } from '@prisma/client';
import {
  extractUploadUrlsFromForumBody,
  isLikelyUploadedImageUrl,
  removeUploadUrlFromForumBody,
} from '../utils/groupPostBodyUploads';
import {
  DEFAULT_GROUP_MAX_STORAGE_BYTES,
  MIN_STORAGE_REQUEST_BYTES,
  formatStorageBytes,
  groupMaxStorageBytes,
  groupStorageExceededMessage,
  storageBytesFromDb,
  storageBytesToDb,
} from '../utils/groupStorageLimits';
import { httpError } from '../utils/httpError';
import {
  managedUploadByteSize,
  tryExtractUploadObjectKey,
} from '../utils/objectStorePaths';
import { getS3Config } from '../utils/s3Config';
import { NotificationService } from './NotificationService';
import type {
  GroupStorageBreakdown,
  GroupStorageCategoryId,
  GroupStorageFileList,
} from '../models';

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
    return groupMaxStorageBytes(group.maxStorageBytes);
  }

  public async trackedBytesForKey(objectKey: string): Promise<number> {
    const row = await prisma.groupStorageFile.findUnique({
      where: { objectKey },
      select: { byteSize: true },
    });
    return row?.byteSize ?? 0;
  }

  public async getUsedStorageBytes(groupId: string): Promise<number> {
    const referenced = await this.collectReferencedUploadUrls(groupId);
    const sizes = await this.sizeMapForGroup(groupId, referenced);
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

    const maxBytes = group ? groupMaxStorageBytes(group.maxStorageBytes) : DEFAULT_GROUP_MAX_STORAGE_BYTES;
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

  public async requireOwnerOrAdmin(groupId: string, userId: string): Promise<void> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, deletedAt: true },
    });
    if (!group || group.deletedAt) {
      throw httpError(404, 'Group not found');
    }
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { status: true, role: true },
    });
    if (
      !member ||
      member.status !== 'active' ||
      (member.role !== 'owner' && member.role !== 'admin')
    ) {
      throw httpError(403, 'Must be a group owner or admin');
    }
  }

  public parseStorageCategory(raw: string): GroupStorageCategoryId {
    if (raw === 'group' || raw === 'events' || raw === 'polls' || raw === 'posts') return raw;
    throw httpError(400, 'category must be group, events, polls, or posts');
  }

  private async sizeMapForGroup(groupId: string, extraUrls: string[]): Promise<Map<string, number>> {
    const tracked = await prisma.groupStorageFile.findMany({
      where: { groupId },
      select: { objectKey: true, byteSize: true },
    });
    const sizes = new Map<string, number>();
    for (const row of tracked) {
      if (row.objectKey) sizes.set(row.objectKey, row.byteSize);
    }
    const cfg = getS3Config();
    for (const url of extraUrls) {
      const key = tryExtractUploadObjectKey(url, cfg);
      if (!key || sizes.has(key)) continue;
      const size = await managedUploadByteSize(url);
      if (size != null && size > 0) sizes.set(key, size);
    }
    return sizes;
  }

  private bytesForUrls(urls: string[], sizes: Map<string, number>): number {
    const cfg = getS3Config();
    const seen = new Set<string>();
    let total = 0;
    for (const url of urls) {
      const key = tryExtractUploadObjectKey(url, cfg) ?? url;
      if (seen.has(key)) continue;
      seen.add(key);
      total += sizes.get(key) ?? 0;
    }
    return total;
  }

  private byteSizeForUrl(url: string, sizes: Map<string, number>): number {
    const key = tryExtractUploadObjectKey(url, getS3Config()) ?? url;
    return sizes.get(key) ?? 0;
  }

  public async collectCategorizedUploadUrls(groupId: string): Promise<{
    events: Array<{ url: string; label: string }>;
    polls: Array<{ url: string; label: string }>;
    posts: Array<{ url: string; label: string }>;
    group: Array<{ url: string; label: string }>;
  }> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        thumbnail: true,
        coverPhotos: { select: { photoUrl: true } },
        events: {
          select: {
            name: true,
            coverPhotos: { select: { photoUrl: true } },
            comments: { select: { photos: { select: { photoUrl: true } } } },
          },
        },
        polls: { select: { title: true, photos: { select: { photoUrl: true } } } },
        posts: {
          select: {
            title: true,
            body: true,
            comments: { select: { body: true } },
          },
        },
      },
    });

    const events: Array<{ url: string; label: string }> = [];
    const polls: Array<{ url: string; label: string }> = [];
    const posts: Array<{ url: string; label: string }> = [];
    const groupFiles: Array<{ url: string; label: string }> = [];
    if (!group) return { events, polls, posts, group: groupFiles };

    const pushUnique = (
      bucket: Array<{ url: string; label: string }>,
      url: string | null | undefined,
      label: string
    ) => {
      const u = url?.trim();
      if (!u) return;
      if (bucket.some((item) => item.url === u)) return;
      bucket.push({ url: u, label });
    };

    pushUnique(groupFiles, group.thumbnail, 'Group photo');
    for (const p of group.coverPhotos) pushUnique(groupFiles, p.photoUrl, 'Group photo');

    for (const ev of group.events) {
      const label = ev.name?.trim() || 'Event';
      for (const p of ev.coverPhotos) pushUnique(events, p.photoUrl, label);
      for (const c of ev.comments) {
        for (const p of c.photos) pushUnique(events, p.photoUrl, label);
      }
    }
    for (const poll of group.polls) {
      const label = poll.title?.trim() || 'Poll';
      for (const p of poll.photos) pushUnique(polls, p.photoUrl, label);
    }
    for (const post of group.posts) {
      const label = post.title?.trim() || 'Post';
      for (const u of extractUploadUrlsFromForumBody(post.body)) {
        pushUnique(posts, u, label);
      }
      for (const c of post.comments) {
        for (const u of extractUploadUrlsFromForumBody(c.body)) {
          pushUnique(posts, u, label);
        }
      }
    }

    return { events, polls, posts, group: groupFiles };
  }

  public async collectReferencedUploadUrls(groupId: string): Promise<string[]> {
    const cats = await this.collectCategorizedUploadUrls(groupId);
    const urls = new Set<string>();
    for (const item of [...cats.events, ...cats.polls, ...cats.posts, ...cats.group]) {
      urls.add(item.url);
    }
    return [...urls];
  }

  public async getBreakdown(groupId: string): Promise<GroupStorageBreakdown> {
    const [cats, maxBytes, usedBytes] = await Promise.all([
      this.collectCategorizedUploadUrls(groupId),
      this.getMaxStorageBytes(groupId),
      this.getUsedStorageBytes(groupId),
    ]);
    const allUrls = [...cats.group, ...cats.events, ...cats.polls, ...cats.posts].map((i) => i.url);
    const sizes = await this.sizeMapForGroup(groupId, allUrls);
    const photoCount = (items: Array<{ url: string }>) =>
      items.filter((i) => isLikelyUploadedImageUrl(i.url)).length;
    const summary = (
      id: GroupStorageCategoryId,
      items: Array<{ url: string }>
    ): GroupStorageBreakdown['categories'][number] => ({
      id,
      usedBytes: this.bytesForUrls(items.map((i) => i.url), sizes),
      fileCount: photoCount(items),
    });
    return {
      usedBytes,
      maxBytes,
      categories: [
        summary('group', cats.group),
        summary('events', cats.events),
        summary('polls', cats.polls),
        summary('posts', cats.posts),
      ],
    };
  }

  public async listFiles(groupId: string, category: GroupStorageCategoryId): Promise<GroupStorageFileList> {
    const cats = await this.collectCategorizedUploadUrls(groupId);
    const items = cats[category].filter((i) => isLikelyUploadedImageUrl(i.url));
    const sizes = await this.sizeMapForGroup(
      groupId,
      items.map((i) => i.url)
    );
    return {
      category,
      files: items.map((item) => ({
        url: item.url,
        byteSize: this.byteSizeForUrl(item.url, sizes),
        sourceLabel: item.label,
      })),
    };
  }

  public async unlinkFileFromGroup(groupId: string, sourceUrl: string): Promise<boolean> {
    const url = sourceUrl.trim();
    if (!url) throw httpError(400, 'url is required');

    const cats = await this.collectCategorizedUploadUrls(groupId);
    const referenced = new Set(
      [...cats.events, ...cats.polls, ...cats.posts, ...cats.group].map((i) => i.url)
    );
    const tracked = await prisma.groupStorageFile.findFirst({
      where: { groupId, publicUrl: url },
      select: { objectKey: true },
    });
    if (!referenced.has(url) && !tracked) {
      throw httpError(404, 'File not found in this group');
    }

    await prisma.eventPhoto.deleteMany({
      where: { photoUrl: url, event: { groupId } },
    });
    await prisma.commentPhoto.deleteMany({
      where: { photoUrl: url, comment: { event: { groupId } } },
    });
    await prisma.pollPhoto.deleteMany({
      where: { photoUrl: url, poll: { groupId } },
    });
    await prisma.groupPhoto.deleteMany({
      where: { groupId, photoUrl: url },
    });
    await prisma.group.updateMany({
      where: { id: groupId, thumbnail: url },
      data: { thumbnail: null },
    });

    const posts = await prisma.groupPost.findMany({
      where: { groupId },
      select: { id: true, body: true },
    });
    for (const post of posts) {
      if (!extractUploadUrlsFromForumBody(post.body).includes(url)) continue;
      const next = removeUploadUrlFromForumBody(post.body, url);
      if (next !== post.body) {
        await prisma.groupPost.update({ where: { id: post.id }, data: { body: next } });
      }
    }

    const comments = await prisma.groupPostComment.findMany({
      where: { post: { groupId } },
      select: { id: true, body: true },
    });
    for (const comment of comments) {
      if (!extractUploadUrlsFromForumBody(comment.body).includes(url)) continue;
      const next = removeUploadUrlFromForumBody(comment.body, url);
      if (next !== comment.body) {
        await prisma.groupPostComment.update({ where: { id: comment.id }, data: { body: next } });
      }
    }

    return true;
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
    requestedBytes: string | number;
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
      requestedBytes: storageBytesFromDb(row.requestedBytes),
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
      select: { status: true, role: true },
    });
    if (!member || member.status !== 'active' || member.role !== 'owner') {
      throw httpError(403, 'Must be the group owner to request more storage');
    }

    const requestedBytes = Math.floor(input.requestedBytes);
    if (!Number.isFinite(requestedBytes) || requestedBytes < MIN_STORAGE_REQUEST_BYTES) {
      throw httpError(400, 'Requested storage must be at least 10 MB');
    }
    if (requestedBytes <= groupMaxStorageBytes(group.maxStorageBytes)) {
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
        requestedBytes: storageBytesToDb(requestedBytes),
        note,
      },
    });
    return this.mapRequest(row);
  }

  public async reduceMaxStorage(input: {
    groupId: string;
    userId: string;
    maxStorageBytes: number;
  }): Promise<{ maxStorageBytes: number }> {
    const group = await prisma.group.findUnique({
      where: { id: input.groupId },
      select: { id: true, name: true, deletedAt: true, maxStorageBytes: true },
    });
    if (!group || group.deletedAt) {
      throw httpError(404, 'Group not found');
    }
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      select: { status: true, role: true },
    });
    if (!member || member.status !== 'active' || member.role !== 'owner') {
      throw httpError(403, 'Must be the group owner to change the storage limit');
    }

    const cap = Math.floor(input.maxStorageBytes);
    if (!Number.isFinite(cap) || cap < MIN_STORAGE_REQUEST_BYTES) {
      throw httpError(400, 'Storage limit must be at least 10 MB');
    }
    if (cap >= groupMaxStorageBytes(group.maxStorageBytes)) {
      throw httpError(400, 'Use a storage request to raise the limit');
    }
    const used = await this.getUsedStorageBytes(input.groupId);
    if (cap <= used) {
      throw httpError(
        400,
        `Storage limit must be higher than current usage (${formatStorageBytes(used)}).`
      );
    }

    await prisma.group.update({
      where: { id: input.groupId },
      data: { maxStorageBytes: storageBytesToDb(cap) },
    });

    const admins = await prisma.groupMember.findMany({
      where: {
        groupId: input.groupId,
        status: 'active',
        role: { in: ['owner', 'admin'] },
      },
      select: { userId: true },
    });
    const ids = [...new Set(admins.map((m) => m.userId))];
    if (ids.length > 0) {
      await notificationService.createForUsers(
        ids,
        'Storage limit lowered',
        `${group.name} can now store up to ${formatStorageBytes(cap)}.`,
        { type: 'group_storage', icon: 'cloud-outline', groupId: input.groupId, dest: 'group' }
      );
    }

    return { maxStorageBytes: cap };
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
      data: { maxStorageBytes: storageBytesToDb(cap) },
    });

    const pending = await prisma.groupStorageRequest.findMany({
      where: { groupId, status: 'pending' },
      select: { id: true, requestedBytes: true },
    });
    const approvedIds = pending
      .filter((row) => storageBytesFromDb(row.requestedBytes) <= cap)
      .map((row) => row.id);
    if (approvedIds.length > 0) {
      await prisma.groupStorageRequest.updateMany({
        where: { id: { in: approvedIds } },
        data: { status: 'approved', decidedAt: new Date() },
      });
    }

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
        currentMaxBytes: groupMaxStorageBytes(group.maxStorageBytes),
        usedBytes,
      });
    }
    return out;
  }
}

export const groupStorage = new GroupStorageService();
