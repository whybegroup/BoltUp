import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Put,
  Query,
  Route,
  Tags,
  SuccessResponse,
} from 'tsoa';
import { Notification, NotificationInput } from '../models';
import { NotificationService } from '../services/NotificationService';

@Route('notifications')
@Tags('Notifications')
export class NotificationController extends Controller {
  private notificationService = new NotificationService();

  /**
   * Get all notifications
   * @summary Retrieves notifications, optionally filtered by user
   */
  @Get()
  public async getNotifications(@Query() userId?: string): Promise<Notification[]> {
    return this.notificationService.getAll(userId);
  }

  /**
   * Get notification by ID
   * @summary Retrieves a single notification
   */
  @Get('{id}')
  public async getNotification(@Path() id: string): Promise<Notification> {
    const notification = await this.notificationService.getById(id);
    if (!notification) {
      this.setStatus(404);
      throw new Error('Notification not found');
    }
    return notification;
  }

  /**
   * Create a notification
   * @summary Creates a new notification
   */
  @Post()
  @SuccessResponse('201', 'Created')
  public async createNotification(@Body() body: NotificationInput): Promise<Notification> {
    this.setStatus(201);
    return this.notificationService.create(body);
  }

  /**
   * Update notification read status
   * @summary Marks a notification as read or unread
   */
  @Put('{id}')
  public async updateNotification(
    @Path() id: string,
    @Body() body: { read: boolean }
  ): Promise<Notification> {
    return this.notificationService.updateReadStatus(id, body.read);
  }
}
