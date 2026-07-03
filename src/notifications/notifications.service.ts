import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { CreateNotificationDto, UpdateNotificationPreferencesDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification | null> {
    // Don't create notification if actor is the recipient
    if (createNotificationDto.actorId === createNotificationDto.recipientId) {
      return null;
    }

    // Check user preferences
    const shouldSend = await this.shouldSendNotification(
      createNotificationDto.recipientId,
      createNotificationDto.type,
    );

    if (!shouldSend) {
      return null;
    }

    const notification = this.notificationsRepository.create(createNotificationDto);
    const saved = await this.notificationsRepository.save(notification);

    // Load actor relation for the real-time emission
    const fullNotification = await this.notificationsRepository.findOne({
      where: { id: saved.id },
      relations: ['actor'],
    });

    // Send real-time notification via WebSocket
    if (fullNotification) {
      this.notificationsGateway.sendNotificationToUser(
        createNotificationDto.recipientId,
        fullNotification,
      );

      // Also send updated unread count
      const unreadCount = await this.getUnreadCount(createNotificationDto.recipientId);
      this.notificationsGateway.sendUnreadCount(
        createNotificationDto.recipientId,
        unreadCount,
      );
    }

    return saved;
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    type?: NotificationType,
  ): Promise<PaginatedResponseDto<Notification>> {
    const where: any = { recipientId: userId };
    if (type) {
      where.type = type;
    }

    const [notifications, total] = await this.notificationsRepository.findAndCount({
      where,
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(notifications, total, page, limit);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    await this.notificationsRepository.save(notification);

    // Send updated unread count
    const unreadCount = await this.getUnreadCount(userId);
    this.notificationsGateway.sendUnreadCount(userId, unreadCount);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { recipientId: userId, isRead: false },
      { isRead: true },
    );

    // Send updated unread count (0)
    this.notificationsGateway.sendUnreadCount(userId, 0);
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationsRepository.remove(notification);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await this.notificationsRepository.delete({ recipientId: userId });
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreference> {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
        likeEnabled: true,
        commentEnabled: true,
        followEnabled: true,
        messageEnabled: true,
        mentionEnabled: true,
      });
      preferences = await this.preferencesRepository.save(preferences);
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    let preferences = await this.getPreferences(userId);

    Object.assign(preferences, updateDto);
    return this.preferencesRepository.save(preferences);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async shouldSendNotification(
    recipientId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const preferences = await this.preferencesRepository.findOne({
      where: { userId: recipientId },
    });

    // If no preferences exist, default to enabled
    if (!preferences) {
      return true;
    }

    switch (type) {
      case NotificationType.LIKE:
        return preferences.likeEnabled;
      case NotificationType.COMMENT:
        return preferences.commentEnabled;
      case NotificationType.FOLLOW:
        return preferences.followEnabled;
      case NotificationType.MESSAGE:
        return preferences.messageEnabled;
      case NotificationType.MENTION:
        return preferences.mentionEnabled;
      default:
        return true;
    }
  }
}
