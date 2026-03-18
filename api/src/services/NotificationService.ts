import { PrismaClient } from '@prisma/client';
import { Notification, NotificationInput } from '../models';

const prisma = new PrismaClient();

export class NotificationService {
  /**
   * Get all notifications with optional user filtering
   */
  public async getAll(userId?: string): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
      where: userId ? { userId } : undefined,
      orderBy: {
        ts: 'desc',
      },
    });
    return notifications.map((n) => this.mapNotification(n));
  }

  /**
   * Get notification by ID
   */
  public async getById(id: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    return notification ? this.mapNotification(notification) : null;
  }

  /**
   * Create a notification
   */
  public async create(input: NotificationInput): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        ...input,
        read: input.read ?? false,
        ts: input.ts ? new Date(input.ts) : new Date(),
        navigable: input.navigable ?? false,
      },
    });
    return this.mapNotification(notification);
  }

  /**
   * Mark notification as read/unread
   */
  public async updateReadStatus(id: string, read: boolean): Promise<Notification> {
    const notification = await prisma.notification.update({
      where: { id },
      data: { read },
    });
    return this.mapNotification(notification);
  }

  /**
   * Map Prisma notification to Notification model
   */
  private mapNotification(n: any): Notification {
    return {
      ...n,
      dest: n.dest as 'group' | 'event' | null,
    };
  }
}
