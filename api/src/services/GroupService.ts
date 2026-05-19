import { PrismaClient } from '@prisma/client';
import {
  Group,
  GroupScoped,
  GroupInput,
  GroupUpdate,
  GroupRole,
  MembershipRequestAction,
  GroupPost,
  GroupPostCreateInput,
  GroupPostUpdateInput,
  GroupPostComment,
  GroupPostCommentCreateInput,
  GroupPostCommentUpdateInput,
  GroupPostReactionInput,
  GroupPostReactionEntry,
  User,
  NotifPrefs,
  NotifPrefsPartial,
} from '../models';
import { mergeNotifPrefs, parseNotifPrefsJson } from '../utils/notifPrefsCore';
import { extractUploadUrlsFromForumBody } from '../utils/groupPostBodyUploads';
import { NotificationService } from './NotificationService';
import { LocalUploadService } from './LocalUploadService';
import { UserService } from './UserService';
import { sortByGroupOrder } from '../utils/groupOrder';

const prisma = new PrismaClient();
const notificationService = new NotificationService();
const localUploads = new LocalUploadService();
const userService = new UserService();

const GROUP_COVER_PHOTOS_INCLUDE = { orderBy: { id: 'asc' as const } };

export class GroupService {
  /**
   * Generate a unique invite code based on group name
   * Format: Only uppercase letters and numbers (e.g., KTH2X9, FOOD42)
   */
  private async generateUniqueInviteCode(groupName: string): Promise<string> {
    // Convert to lowercase and remove special characters
    const cleaned = groupName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    
    // Take first 2-3 words or first 12 characters
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    let base = '';
    
    if (words.length >= 2) {
      // Use first letters of first 2-3 words (e.g., "KTown Hangout" -> "KTH")
      base = words.slice(0, 3).map(w => w[0]).join('');
    } else if (words.length === 1) {
      // Use first 3-4 letters of single word (e.g., "Foodies" -> "FOOD")
      base = words[0].substring(0, 4);
    }
    
    // If base is empty, use a default
    if (!base) {
      base = 'GRP';
    }
    
    base = base.toUpperCase();
    
    // Get all existing invite codes that start with this base
    const existingCodes = await prisma.group.findMany({
      where: {
        inviteCode: {
          startsWith: base,
        },
      },
      select: {
        inviteCode: true,
      },
    });
    
    const existingSet = new Set(existingCodes.map(g => g.inviteCode));
    
    // Helper to generate random alphanumeric string (uppercase letters + numbers only)
    const generateAlphanumeric = (length: number): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Strategy 1: Try random 4-char alphanumeric suffixes (fast, readable)
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = generateAlphanumeric(4);
      const inviteCode = `${base}${suffix}`;
      
      if (!existingSet.has(inviteCode)) {
        return inviteCode;
      }
    }
    
    // Strategy 2: Use sequential counter based on existing codes
    // Extract numbers from existing codes with this base
    let maxNumber = 0;
    existingCodes.forEach(({ inviteCode }) => {
      if (inviteCode) {
        // Match trailing numbers (e.g., KTH123 -> 123)
        const match = inviteCode.match(/(\d+)$/);
        if (match) {
          maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
        }
      }
    });
    
    // Use next sequential number
    const nextNumber = maxNumber + 1;
    const inviteCode = `${base}${nextNumber}`;
    
    // Final check (should always be unique due to sequential numbering)
    const finalCheck = await prisma.group.findUnique({
      where: { inviteCode },
    });
    
    if (!finalCheck) {
      return inviteCode;
    }
    
    // Ultimate fallback: base + timestamp (guaranteed unique)
    const timestamp = Date.now();
    return `${base}${timestamp}`;
  }

  /**
   * Get all groups with member information
   */
  public async getAll(): Promise<Group[]> {
    const groups = await prisma.group.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    return groups.map((g) => this.mapGroupWithMembers(g));
  }

  /**
   * Get all groups scoped by user's membership status.
   * By default excludes soft-deleted groups.
   * When includeDeleted=true, also returns soft-deleted groups where user is owner.
   */
  public async getAllForUser(userId: string, includeDeleted = false): Promise<GroupScoped[]> {
    const groups = await prisma.group.findMany({
      where: includeDeleted
        ? {
            OR: [
              { deletedAt: null },
              {
                deletedAt: { not: null },
                members: {
                  some: {
                    userId,
                    role: 'owner',
                    status: 'active',
                  },
                },
              },
            ],
          }
        : { deletedAt: null },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    const mapped = groups.map((g) => this.mapGroupScoped(g, userId));
    const orderIds = await userService.getGroupOrder(userId);
    return sortByGroupOrder(mapped, orderIds);
  }

  /**
   * Get group by ID with member information
   */
  public async getById(id: string): Promise<Group | null> {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    return group ? this.mapGroupWithMembers(group) : null;
  }

  /**
   * Get group by ID scoped by user's membership status.
   * Soft-deleted groups only visible to owner.
   */
  public async getByIdForUser(id: string, userId: string): Promise<GroupScoped | null> {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    if (!group) return null;
    if (group.deletedAt && group.deletedBy) {
      const isOwner = group.members.some(
        (m: any) => m.userId === userId && m.role === 'owner' && m.status === 'active'
      );
      if (!isOwner) return null;
    }
    return this.mapGroupScoped(group, userId);
  }

  private mapGroupCoverUrls(group: { coverPhotos?: { photoUrl: string }[] }): string[] {
    if (!group.coverPhotos?.length) return [];
    return group.coverPhotos.map((p) => p.photoUrl);
  }

  /**
   * Map Prisma group to GroupScoped based on user's membership
   */
  private mapGroupScoped(group: any, userId: string): GroupScoped {
    const owner = group.members.find((m: any) => m.role === 'owner' && m.status === 'active');
    const admins = group.members.filter(
      (m: any) => (m.role === 'admin' || m.role === 'owner') && m.status === 'active'
    );
    const activeMembers = group.members.filter((m: any) => m.status === 'active');
    const pendingMembers = group.members.filter((m: any) => m.status === 'pending');
    const memberCount = activeMembers.length;

    const myMembership = group.members.find((m: any) => m.userId === userId);
    let membershipStatus: 'none' | 'pending' | 'member' | 'admin' = 'none';
    if (myMembership) {
      if (myMembership.status === 'pending') membershipStatus = 'pending';
      else if (myMembership.role === 'owner' || myMembership.role === 'admin') membershipStatus = 'admin';
      else membershipStatus = 'member';
    }

    const base: GroupScoped = {
      id: group.id,
      name: group.name,
      desc: group.desc,
      announcement: group.announcement ?? null,
      thumbnail: group.thumbnail,
      coverPhotos: this.mapGroupCoverUrls(group),
      avatarSeed: group.avatarSeed,
      requireApprovalToJoin: group.requireApprovalToJoin ?? true,
      memberCount,
      membershipStatus,
      deletedAt: group.deletedAt ?? undefined,
      deletedBy: group.deletedBy ?? undefined,
    };

    if (membershipStatus === 'member' || membershipStatus === 'admin') {
      base.inviteCode = group.inviteCode;
      base.ownerId = owner?.userId;
      base.adminIds = admins.map((m: any) => m.userId);
      base.memberIds = activeMembers.map((m: any) => m.userId);
      base.createdBy = group.createdBy;
      base.updatedBy = group.updatedBy;
      base.createdAt = group.createdAt;
      base.updatedAt = group.updatedAt;
      if (membershipStatus === 'admin') {
        base.pendingMemberIds = pendingMembers.map((m: any) => m.userId);
      }
    } else if (membershipStatus === 'pending') {
      base.createdBy = group.createdBy;
    }

    return base;
  }

  /**
   * Create a new group with members
   */
  public async create(input: GroupInput): Promise<Group> {
    const {
      ownerId,
      adminIds = [],
      memberIds = [],
      createdBy,
      inviteCode,
      coverPhotos = [],
      ...groupData
    } = input;

    if (!ownerId?.trim() || !createdBy?.trim()) {
      throw Object.assign(new Error('ownerId and createdBy are required'), { status: 400 });
    }
    const actorIds = Array.from(
      new Set([ownerId, createdBy, ...adminIds, ...memberIds].map((x) => x?.trim()).filter(Boolean) as string[]),
    );
    const createdByT = createdBy.trim();
    const ownerT = ownerId.trim();
    let existingUsers = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true },
    });
    let existingIds = new Set(existingUsers.map((u) => u.id));
    let missing = actorIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      const userService = new UserService();
      for (const id of missing) {
        if (id !== createdByT && id !== ownerT) {
          throw Object.assign(new Error(`Unknown user id(s): ${missing.join(', ')}`), { status: 400 });
        }
        await userService.upsertFromAuth({
          id,
          name: 'User',
          displayName: 'User',
        });
      }
      existingUsers = await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true },
      });
      existingIds = new Set(existingUsers.map((u) => u.id));
      missing = actorIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        throw Object.assign(new Error(`Unknown user id(s): ${missing.join(', ')}`), { status: 400 });
      }
    }

    // Generate unique invite code if not provided
    const finalInviteCode = inviteCode || await this.generateUniqueInviteCode(input.name);

    // Create group with members
    const group = await prisma.group.create({
      data: {
        ...groupData,
        inviteCode: finalInviteCode,
        createdBy,
        updatedBy: createdBy,
        coverPhotos: {
          create: coverPhotos.map((photoUrl) => ({ photoUrl })),
        },
        members: {
          create: [
            // Super admin
            { userId: ownerId.trim(), role: 'owner' },
            // Other admins
            ...adminIds
              .map((uid) => uid?.trim())
              .filter((uid): uid is string => !!uid && uid !== ownerId)
              .map((userId) => ({ userId, role: 'admin' as GroupRole })),
            // Regular members
            ...memberIds
              .map((uid) => uid?.trim())
              .filter((uid): uid is string => !!uid && uid !== ownerId && !adminIds.includes(uid))
              .map((userId) => ({ userId, role: 'member' as GroupRole })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    return this.mapGroupWithMembers(group);
  }

  /**
   * Update a group
   */
  public async update(id: string, input: GroupUpdate): Promise<Group> {
    const { ownerId, adminIds, memberIds, updatedBy, coverPhotos, ...groupData } = input;

    // If member lists are provided, update them
    if (ownerId || adminIds || memberIds) {
      await prisma.$transaction(async (tx) => {
        // Delete existing members
        await tx.groupMember.deleteMany({
          where: { groupId: id },
        });

        // Create new members
        const membersToCreate = [];
        
        if (ownerId) {
          membersToCreate.push({ groupId: id, userId: ownerId, role: 'owner' });
        }

        if (adminIds) {
          adminIds
            .filter((uid) => uid !== ownerId)
            .forEach((userId) => {
              membersToCreate.push({ groupId: id, userId, role: 'admin' });
            });
        }

        if (memberIds) {
          memberIds
            .filter((uid) => uid !== ownerId && !adminIds?.includes(uid))
            .forEach((userId) => {
              membersToCreate.push({ groupId: id, userId, role: 'member' });
            });
        }

        if (membersToCreate.length > 0) {
          await tx.groupMember.createMany({
            data: membersToCreate,
          });
        }
      });
    }

    if (coverPhotos !== undefined) {
      const existing = await prisma.group.findUnique({
        where: { id },
        select: { coverPhotos: { select: { photoUrl: true } } },
      });
      if (existing) {
        const previousUrls = existing.coverPhotos.map((p) => p.photoUrl);
        const nextSet = new Set(coverPhotos);
        const removedUrls = previousUrls.filter((u) => !nextSet.has(u));

        await prisma.$transaction(async (tx) => {
          await tx.groupPhoto.deleteMany({ where: { groupId: id } });
          if (coverPhotos.length > 0) {
            await tx.groupPhoto.createMany({
              data: coverPhotos.map((photoUrl) => ({ groupId: id, photoUrl })),
            });
          }
        });

        await Promise.all(removedUrls.map((u) => localUploads.deleteManagedUploadBestEffort(u)));
      }
    }

    // Update group data
    if (Object.keys(groupData).length > 0 || updatedBy) {
      await prisma.group.update({
        where: { id },
        data: {
          ...groupData,
          updatedBy,
        },
      });
    }

    // Fetch and return updated group
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        coverPhotos: GROUP_COVER_PHOTOS_INCLUDE,
      },
    });

    return this.mapGroupWithMembers(group!);
  }

  /**
   * Replace the group's invite code with a newly generated unique code.
   * Does not change memberships — only affects joining via the old code or link.
   */
  public async regenerateInviteCode(id: string, updatedBy: string): Promise<{ inviteCode: string }> {
    const row = await prisma.group.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new Error('Group not found');
    }
    const inviteCode = await this.generateUniqueInviteCode(row.name);
    await prisma.group.update({
      where: { id },
      data: { inviteCode, updatedBy },
    });
    return { inviteCode };
  }

  /**
   * Hard-delete a group (removes group and all related data). Owner only.
   * Best-effort removal of group thumbnail and all event / comment photos from S3.
   */
  public async hardDelete(id: string, userId: string): Promise<void> {
    await this.requireOwner(id, userId);
    const snapshot = await prisma.group.findUnique({
      where: { id },
      select: {
        thumbnail: true,
        coverPhotos: { select: { photoUrl: true } },
        events: {
          select: {
            coverPhotos: { select: { photoUrl: true } },
            comments: {
              select: {
                photos: { select: { photoUrl: true } },
              },
            },
          },
        },
      },
    });
    if (!snapshot) {
      throw Object.assign(new Error('Group not found'), { status: 404 });
    }

    const urls: string[] = [];
    const t = snapshot.thumbnail?.trim();
    if (t) urls.push(t);
    for (const gp of snapshot.coverPhotos) {
      const u = gp.photoUrl?.trim();
      if (u) urls.push(u);
    }
    for (const ev of snapshot.events) {
      for (const p of ev.coverPhotos) urls.push(p.photoUrl);
      for (const c of ev.comments) {
        for (const p of c.photos) urls.push(p.photoUrl);
      }
    }
    const urlsToPurge = [...new Set(urls)];

    await prisma.group.delete({
      where: { id },
    });
    await Promise.all(urlsToPurge.map((u) => localUploads.deleteManagedUploadBestEffort(u)));
  }

  /**
   * Soft-delete a group. Owner only.
   */
  public async softDelete(id: string, userId: string): Promise<void> {
    await this.requireOwner(id, userId);
    await prisma.group.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  /**
   * Recover a soft-deleted group. Owner only.
   */
  public async recoverGroup(id: string, userId: string): Promise<void> {
    await this.requireOwner(id, userId);
    await prisma.group.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  private async requireOwner(groupId: string, userId: string): Promise<void> {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true, status: true },
    });
    if (!member || member.role !== 'owner' || member.status !== 'active') {
      throw new Error('Must be owner to perform this action');
    }
  }

  private async requireActiveMember(groupId: string, userId: string): Promise<void> {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new Error('Must be an active member to access group posts');
    }
  }

  private mapReactionEntries(
    rows: Array<{ emoji: string; userId: string }>
  ): GroupPostReactionEntry[] {
    const byEmoji = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = byEmoji.get(row.emoji) ?? new Set<string>();
      set.add(row.userId);
      byEmoji.set(row.emoji, set);
    }
    return [...byEmoji.entries()].map(([emoji, userIds]) => ({
      emoji,
      count: userIds.size,
      userIds: [...userIds],
    }));
  }

  private mapGroupPostComment(row: any): GroupPostComment {
    return {
      id: row.id,
      postId: row.postId,
      userId: row.userId,
      body: row.body,
      parentCommentId: row.parentCommentId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reactions: this.mapReactionEntries(row.reactions ?? []),
    };
  }

  private mapGroupPost(row: any): GroupPost {
    return {
      id: row.id,
      groupId: row.groupId,
      userId: row.userId,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reactions: this.mapReactionEntries(row.reactions ?? []),
      comments: (row.comments ?? []).map((c: any) => this.mapGroupPostComment(c)),
    };
  }

  public async getGroupPosts(groupId: string, userId: string): Promise<GroupPost[]> {
    await this.requireActiveMember(groupId, userId);
    const rows = await prisma.groupPost.findMany({
      where: { groupId },
      include: {
        reactions: { select: { emoji: true, userId: true } },
        comments: {
          include: { reactions: { select: { emoji: true, userId: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapGroupPost(r));
  }

  public async createGroupPost(groupId: string, input: GroupPostCreateInput): Promise<GroupPost> {
    await this.requireActiveMember(groupId, input.userId);
    const created = await prisma.groupPost.create({
      data: {
        id: input.id,
        groupId,
        userId: input.userId,
        title: input.title.trim(),
        body: input.body,
      },
      include: {
        reactions: { select: { emoji: true, userId: true } },
        comments: {
          include: { reactions: { select: { emoji: true, userId: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return this.mapGroupPost(created);
  }

  public async updateGroupPost(postId: string, input: GroupPostUpdateInput): Promise<GroupPost> {
    const post = await prisma.groupPost.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true, userId: true },
    });
    if (!post) throw new Error('Post not found');
    if (post.userId !== input.userId) {
      throw new Error('You can only edit your own post');
    }
    await this.requireActiveMember(post.groupId, input.userId);
    const body = input.body.trim();
    if (!body) throw new Error('Post body is required');
    const title = input.title.trim() || 'Post';
    const updated = await prisma.groupPost.update({
      where: { id: postId },
      data: {
        title,
        body,
      },
      include: {
        reactions: { select: { emoji: true, userId: true } },
        comments: {
          include: { reactions: { select: { emoji: true, userId: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return this.mapGroupPost(updated);
  }

  public async deleteGroupPost(postId: string, userId: string): Promise<void> {
    const post = await prisma.groupPost.findUnique({
      where: { id: postId },
      select: {
        groupId: true,
        userId: true,
        body: true,
        comments: { select: { body: true } },
      },
    });
    if (!post) throw new Error('Post not found');
    if (post.userId !== userId) {
      throw new Error('You can only delete your own post');
    }
    await this.requireActiveMember(post.groupId, userId);
    const urlsToPurge = [
      ...new Set([
        ...extractUploadUrlsFromForumBody(post.body),
        ...post.comments.flatMap((c) => extractUploadUrlsFromForumBody(c.body)),
      ]),
    ];
    await prisma.groupPost.delete({ where: { id: postId } });
    await Promise.all(urlsToPurge.map((u) => localUploads.deleteManagedUploadBestEffort(u)));
  }

  public async toggleGroupPostReaction(postId: string, input: GroupPostReactionInput): Promise<GroupPost> {
    const post = await prisma.groupPost.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true },
    });
    if (!post) throw new Error('Post not found');
    await this.requireActiveMember(post.groupId, input.userId);
    const existing = await prisma.groupPostReaction.findUnique({
      where: {
        postId_userId_emoji: {
          postId,
          userId: input.userId,
          emoji: input.emoji,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.groupPostReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.groupPostReaction.create({
        data: {
          postId,
          userId: input.userId,
          emoji: input.emoji,
        },
      });
    }
    const refreshed = await prisma.groupPost.findUnique({
      where: { id: postId },
      include: {
        reactions: { select: { emoji: true, userId: true } },
        comments: {
          include: { reactions: { select: { emoji: true, userId: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!refreshed) throw new Error('Post not found');
    return this.mapGroupPost(refreshed);
  }

  public async createGroupPostComment(
    postId: string,
    input: GroupPostCommentCreateInput
  ): Promise<GroupPostComment> {
    const post = await prisma.groupPost.findUnique({
      where: { id: postId },
      select: { groupId: true },
    });
    if (!post) throw new Error('Post not found');
    await this.requireActiveMember(post.groupId, input.userId);
    if (input.parentCommentId) {
      const parent = await prisma.groupPostComment.findUnique({
        where: { id: input.parentCommentId },
        select: { postId: true },
      });
      if (!parent || parent.postId !== postId) {
        throw new Error('Parent comment not found');
      }
    }
    const created = await prisma.groupPostComment.create({
      data: {
        id: input.id,
        postId,
        userId: input.userId,
        body: input.body,
        parentCommentId: input.parentCommentId ?? null,
      },
      include: { reactions: { select: { emoji: true, userId: true } } },
    });
    return this.mapGroupPostComment(created);
  }

  public async updateGroupPostComment(
    commentId: string,
    input: GroupPostCommentUpdateInput
  ): Promise<GroupPostComment> {
    const comment = await prisma.groupPostComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { groupId: true } } },
    });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== input.userId) {
      throw new Error('You can only edit your own comment');
    }
    await this.requireActiveMember(comment.post.groupId, input.userId);
    const body = input.body.trim();
    if (!body) throw new Error('Comment body is required');

    const postId = comment.postId;
    let nextParentId: string | null | undefined = undefined;
    if (input.parentCommentId !== undefined) {
      if (input.parentCommentId === null) {
        nextParentId = null;
      } else {
        const parentId = input.parentCommentId.trim();
        if (parentId === commentId) {
          throw new Error('A comment cannot be its own parent');
        }
        const parent = await prisma.groupPostComment.findUnique({
          where: { id: parentId },
          select: { postId: true },
        });
        if (!parent || parent.postId !== postId) {
          throw new Error('Parent comment not found');
        }
        const blocked = await this.collectDescendantCommentIds(commentId);
        if (blocked.has(parentId)) {
          throw new Error('Cannot reply to a reply of this comment');
        }
        nextParentId = parentId;
      }
    }

    const updated = await prisma.groupPostComment.update({
      where: { id: commentId },
      data: {
        body,
        ...(nextParentId !== undefined ? { parentCommentId: nextParentId } : {}),
      },
      include: { reactions: { select: { emoji: true, userId: true } } },
    });
    return this.mapGroupPostComment(updated);
  }

  /** Includes `rootId` and all transitive replies under it. */
  private async collectDescendantCommentIds(rootId: string): Promise<Set<string>> {
    const ids = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const children = await prisma.groupPostComment.findMany({
        where: { parentCommentId: id },
        select: { id: true },
      });
      for (const ch of children) {
        if (!ids.has(ch.id)) {
          ids.add(ch.id);
          queue.push(ch.id);
        }
      }
    }
    return ids;
  }

  public async deleteGroupPostComment(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.groupPostComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { groupId: true } } },
    });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId) {
      throw new Error('You can only delete your own comment');
    }
    await this.requireActiveMember(comment.post.groupId, userId);
    const urlsToPurge = extractUploadUrlsFromForumBody(comment.body);
    await prisma.groupPostComment.delete({ where: { id: commentId } });
    await Promise.all(urlsToPurge.map((u) => localUploads.deleteManagedUploadBestEffort(u)));
  }

  public async toggleGroupPostCommentReaction(
    commentId: string,
    input: GroupPostReactionInput
  ): Promise<GroupPostComment> {
    const comment = await prisma.groupPostComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { groupId: true } } },
    });
    if (!comment) throw new Error('Comment not found');
    await this.requireActiveMember(comment.post.groupId, input.userId);
    const existing = await prisma.groupPostCommentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: input.userId,
          emoji: input.emoji,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.groupPostCommentReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.groupPostCommentReaction.create({
        data: {
          commentId,
          userId: input.userId,
          emoji: input.emoji,
        },
      });
    }
    const refreshed = await prisma.groupPostComment.findUnique({
      where: { id: commentId },
      include: { reactions: { select: { emoji: true, userId: true } } },
    });
    if (!refreshed) throw new Error('Comment not found');
    return this.mapGroupPostComment(refreshed);
  }

  /**
   * Get members of a group
   */
  public async getMembers(groupId: string) {
    return prisma.user.findMany({
      where: {
        groupMemberships: {
          some: {
            groupId,
          },
        },
      },
    });
  }

  /**
   * Get pending membership requests for a group
   */
  public async getPendingRequests(groupId: string): Promise<User[]> {
    const pendingMembers = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'pending',
      },
      include: {
        user: true,
      },
    });

    return pendingMembers.map((m) => m.user) as User[];
  }

  /**
   * Join a group by invite code. If requireApprovalToJoin is false, membership is immediate; otherwise pending.
   * Returns groupName and status for UI feedback.
   */
  public async joinByInviteCode(
    inviteCode: string,
    userId: string
  ): Promise<{ groupName: string; status: 'joined' | 'pending' }> {
    // Extract code from URL (e.g. moijia.app/join/ABC123) or use as-is
    let raw = inviteCode.trim();
    const joinMatch = raw.match(/\/join\/([A-Za-z0-9]+)/i);
    if (joinMatch) raw = joinMatch[1];
    const normalized = raw.toUpperCase();
    const group = await prisma.group.findUnique({
      where: { inviteCode: normalized },
    });
    if (!group || group.deletedAt) {
      throw new Error('Invalid invite code');
    }
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });
    const wasActive = existing?.status === 'active';
    const wasPending = existing?.status === 'pending';
    await this.joinGroup(group.id, userId);
    if (wasActive || wasPending) {
      return { groupName: group.name, status: wasActive ? 'joined' : 'pending' };
    }
    return {
      groupName: group.name,
      status: group.requireApprovalToJoin ? 'pending' : 'joined',
    };
  }

  /**
   * Join a group. If requireApprovalToJoin is false, membership is immediate; otherwise pending.
   */
  public async joinGroup(groupId: string, userId: string): Promise<void> {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new Error('Group not found');
    }

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
    if (existing) {
      if (existing.status === 'active') return; // Already a member
      if (existing.status === 'pending') return; // Request already sent
      if (existing.status === 'rejected') {
        const status = group.requireApprovalToJoin ? 'pending' : 'active';
        await prisma.groupMember.update({
          where: { groupId_userId: { groupId, userId } },
          data: { status },
        });
        return;
      }
    } else {
      const status = group.requireApprovalToJoin ? 'pending' : 'active';
      await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          role: 'member',
          status,
        },
      });
    }
  }

  /**
   * Remove a member from the group. Admin only. Cannot remove owner.
   */
  public async removeMember(
    groupId: string,
    memberId: string,
    performedBy: string
  ): Promise<void> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { where: { status: 'active' } } },
    });
    if (!group) throw new Error('Group not found');
    const performer = group.members.find((m: any) => m.userId === performedBy);
    const target = group.members.find((m: any) => m.userId === memberId);
    if (!performer || (performer.role !== 'admin' && performer.role !== 'owner')) {
      throw new Error('Must be admin to remove members');
    }
    if (!target) throw new Error('Member not found');
    if (target.role === 'owner') {
      throw new Error('Cannot remove owner from group');
    }
    
    // Get member's RSVPs to check which were "going"
    const groupEvents = await prisma.event.findMany({
      where: { groupId },
      select: { id: true },
    });
    const eventIds = groupEvents.map(e => e.id);
    
    const memberRsvps = await prisma.rSVP.findMany({
      where: {
        userId: memberId,
        eventId: { in: eventIds },
      },
    });
    
    const goingEventIds = memberRsvps
      .filter(r => r.status === 'going')
      .map(r => r.eventId);
    
    await prisma.$transaction([
      // Delete RSVPs for this user in all group events
      prisma.rSVP.deleteMany({
        where: {
          userId: memberId,
          eventId: { in: eventIds },
        },
      }),
      // Remove member from group
      prisma.groupMember.deleteMany({
        where: { groupId, userId: memberId },
      }),
    ]);
    
    // Promote waitlisted users for events where this member was "going"
    const { EventService } = await import('./EventService');
    const eventService = new EventService();
    for (const eventId of goingEventIds) {
      await (eventService as any).promoteFromWaitlist(eventId);
    }
  }

  /**
   * Set a member's role (admin or member). Admin only. Cannot change owner.
   */
  public async setMemberRole(
    groupId: string,
    memberId: string,
    role: 'admin' | 'member',
    performedBy: string
  ): Promise<void> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new Error('Group not found');
    const performer = group.members.find((m: any) => m.userId === performedBy && m.status === 'active');
    const target = group.members.find((m: any) => m.userId === memberId && m.status === 'active');
    if (!performer || (performer.role !== 'admin' && performer.role !== 'owner')) {
      throw new Error('Must be admin to change member roles');
    }
    if (!target) throw new Error('Member not found');
    if (target.role === 'owner') {
      throw new Error('Cannot change owner role');
    }
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: memberId } },
      data: { role },
    });
  }

  /**
   * Transfer owner role to another member. Owner only.
   */
  public async setOwner(
    groupId: string,
    newOwnerId: string,
    performedBy: string
  ): Promise<void> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new Error('Group not found');
    const performer = group.members.find((m: any) => m.userId === performedBy && m.status === 'active');
    const target = group.members.find((m: any) => m.userId === newOwnerId && m.status === 'active');
    if (!performer || performer.role !== 'owner') {
      throw new Error('Must be owner to transfer ownership');
    }
    if (!target) throw new Error('Member not found');
    if (target.role === 'owner') throw new Error('Already owner');
    await prisma.$transaction([
      prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: performedBy } },
        data: { role: 'admin' },
      }),
      prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: newOwnerId } },
        data: { role: 'owner' },
      }),
    ]);
  }

  /**
   * Leave a group (remove current user from members).
   * Owner cannot leave; they must soft-delete or hard-delete instead.
   */
  public async leaveGroup(groupId: string, userId: string): Promise<void> {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
    if (member?.role === 'owner') {
      throw new Error('Owner cannot leave the group.');
    }
    
    // Get user's RSVPs to check which were "going"
    const groupEvents = await prisma.event.findMany({
      where: { groupId },
      select: { id: true },
    });
    const eventIds = groupEvents.map(e => e.id);
    
    const userRsvps = await prisma.rSVP.findMany({
      where: {
        userId,
        eventId: { in: eventIds },
      },
    });
    
    const goingEventIds = userRsvps
      .filter(r => r.status === 'going')
      .map(r => r.eventId);
    
    await prisma.$transaction([
      // Delete RSVPs for this user in all group events
      prisma.rSVP.deleteMany({
        where: {
          userId,
          eventId: { in: eventIds },
        },
      }),
      // Remove user from group
      prisma.groupMember.deleteMany({
        where: {
          groupId,
          userId,
        },
      }),
    ]);
    
    // Promote waitlisted users for events where this user was "going"
    const { EventService } = await import('./EventService');
    const eventService = new EventService();
    for (const eventId of goingEventIds) {
      await (eventService as any).promoteFromWaitlist(eventId);
    }
  }

  /**
   * Handle membership request (approve or reject)
   */
  public async handleMembershipRequest(
    groupId: string,
    action: MembershipRequestAction
  ): Promise<void> {
    const { userId, action: requestAction } = action;

    if (requestAction === 'approve') {
      await prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        data: {
          status: 'active',
        },
      });

      // Create in-app notification for approved user
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (group) {
        await notificationService.createForUser(
          userId,
          'Request Approved',
          `You've been approved to join ${group.name}`,
          {
            type: 'group_approval',
            icon: '✓',
            groupId: group.id,
            dest: 'group',
          }
        ).catch(() => undefined);
      }
    } else if (requestAction === 'reject') {
      // Get user's RSVPs to check which were "going"
      const groupEvents = await prisma.event.findMany({
        where: { groupId },
        select: { id: true },
      });
      const eventIds = groupEvents.map(e => e.id);
      
      const userRsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          eventId: { in: eventIds },
        },
      });
      
      const goingEventIds = userRsvps
        .filter(r => r.status === 'going')
        .map(r => r.eventId);
      
      await prisma.$transaction([
        // Delete RSVPs for this user in all group events
        prisma.rSVP.deleteMany({
          where: {
            userId,
            eventId: { in: eventIds },
          },
        }),
        // Remove member from group
        prisma.groupMember.deleteMany({
          where: {
            groupId,
            userId,
          },
        }),
      ]);
      
      // Promote waitlisted users for events where this user was "going"
      const { EventService } = await import('./EventService');
      const eventService = new EventService();
      for (const eventId of goingEventIds) {
        await (eventService as any).promoteFromWaitlist(eventId);
      }
    }
  }

  /**
   * Update user's color preference for a group
   */
  public async updateMemberColor(
    groupId: string,
    userId: string,
    colorHex: string
  ): Promise<void> {
    await prisma.groupMember.updateMany({
      where: {
        groupId,
        userId,
        status: 'active',
      },
      data: {
        colorHex,
      },
    });
  }

  /**
   * Get user's color preference for a group
   */
  public async getMemberColor(
    groupId: string,
    userId: string
  ): Promise<string | null> {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        colorHex: true,
      },
    });

    return member?.colorHex || null;
  }

  /**
   * Get all group color preferences for a user
   */
  public async getAllMemberColors(userId: string): Promise<Record<string, string>> {
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId,
        status: 'active',
        colorHex: {
          not: null,
        },
      },
      select: {
        groupId: true,
        colorHex: true,
      },
    });

    const colors: Record<string, string> = {};
    memberships.forEach((m) => {
      if (m.colorHex) {
        colors[m.groupId] = m.colorHex;
      }
    });

    return colors;
  }

  /**
   * Update current user's per-group notification preferences (merged into existing JSON).
   */
  public async updateMemberNotifPrefs(
    groupId: string,
    userId: string,
    prefs: NotifPrefsPartial
  ): Promise<void> {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
      select: { notifPrefsJson: true },
    });
    const merged = mergeNotifPrefs(parseNotifPrefsJson(member?.notifPrefsJson), prefs);
    await prisma.groupMember.updateMany({
      where: {
        groupId,
        userId,
        status: 'active',
      },
      data: {
        notifPrefsJson: JSON.stringify(merged),
      },
    });
  }

  /**
   * Resolved per-group notification preferences (defaults applied).
   */
  public async getMemberNotifPrefs(groupId: string, userId: string): Promise<NotifPrefs> {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
      select: { notifPrefsJson: true },
    });
    return parseNotifPrefsJson(member?.notifPrefsJson);
  }

  /**
   * Map Prisma group with members to Group model
   */
  private mapGroupWithMembers(group: any): Group {
    const owner = group.members.find((m: any) => m.role === 'owner' && m.status === 'active');
    const admins = group.members.filter(
      (m: any) => (m.role === 'admin' || m.role === 'owner') && m.status === 'active'
    );
    const activeMembers = group.members.filter((m: any) => m.status === 'active');
    const pendingMembers = group.members.filter((m: any) => m.status === 'pending');

    return {
      id: group.id,
      name: group.name,
      desc: group.desc,
      announcement: group.announcement ?? null,
      thumbnail: group.thumbnail,
      coverPhotos: this.mapGroupCoverUrls(group),
      avatarSeed: group.avatarSeed,
      inviteCode: group.inviteCode,
      requireApprovalToJoin: group.requireApprovalToJoin ?? true,
      ownerId: owner ? owner.userId : '',
      adminIds: admins.map((m: any) => m.userId),
      memberIds: activeMembers.map((m: any) => m.userId),
      pendingMemberIds: pendingMembers.map((m: any) => m.userId),
      createdBy: group.createdBy,
      updatedBy: group.updatedBy,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
