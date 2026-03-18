import { PrismaClient } from '@prisma/client';
import { Group, GroupInput, GroupUpdate, GroupRole } from '../models';

const prisma = new PrismaClient();

export class GroupService {
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
      },
    });

    return groups.map((g) => this.mapGroupWithMembers(g));
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
      },
    });

    return group ? this.mapGroupWithMembers(group) : null;
  }

  /**
   * Create a new group with members
   */
  public async create(input: GroupInput): Promise<Group> {
    const { superAdminId, adminIds = [], memberIds = [], ...groupData } = input;

    // Create group with members
    const group = await prisma.group.create({
      data: {
        ...groupData,
        members: {
          create: [
            // Super admin
            { userId: superAdminId, role: 'superadmin' },
            // Other admins
            ...adminIds
              .filter((uid) => uid !== superAdminId)
              .map((userId) => ({ userId, role: 'admin' as GroupRole })),
            // Regular members
            ...memberIds
              .filter((uid) => uid !== superAdminId && !adminIds.includes(uid))
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
      },
    });

    return this.mapGroupWithMembers(group);
  }

  /**
   * Update a group
   */
  public async update(id: string, input: GroupUpdate): Promise<Group> {
    const { superAdminId, adminIds, memberIds, ...groupData } = input;

    // If member lists are provided, update them
    if (superAdminId || adminIds || memberIds) {
      await prisma.$transaction(async (tx) => {
        // Delete existing members
        await tx.groupMember.deleteMany({
          where: { groupId: id },
        });

        // Create new members
        const membersToCreate = [];
        
        if (superAdminId) {
          membersToCreate.push({ groupId: id, userId: superAdminId, role: 'superadmin' });
        }

        if (adminIds) {
          adminIds
            .filter((uid) => uid !== superAdminId)
            .forEach((userId) => {
              membersToCreate.push({ groupId: id, userId, role: 'admin' });
            });
        }

        if (memberIds) {
          memberIds
            .filter((uid) => uid !== superAdminId && !adminIds?.includes(uid))
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

    // Update group data
    if (Object.keys(groupData).length > 0) {
      await prisma.group.update({
        where: { id },
        data: groupData,
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
      },
    });

    return this.mapGroupWithMembers(group!);
  }

  /**
   * Delete a group
   */
  public async delete(id: string): Promise<void> {
    await prisma.group.delete({
      where: { id },
    });
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
   * Map Prisma group with members to Group model
   */
  private mapGroupWithMembers(group: any): Group {
    const superAdmin = group.members.find((m: any) => m.role === 'superadmin');
    const admins = group.members.filter(
      (m: any) => m.role === 'admin' || m.role === 'superadmin'
    );

    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      colorHex: group.colorHex,
      desc: group.desc,
      isPublic: group.isPublic,
      superAdminId: superAdmin ? superAdmin.userId : '',
      adminIds: admins.map((m: any) => m.userId),
      memberIds: group.members.map((m: any) => m.userId),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
