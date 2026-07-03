import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map userId -> Set of socket IDs
  private connectedUsers = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      client.disconnect();
      return;
    }

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(client.id);

    // Join a personal room for targeted notifications
    client.join(`user_${userId}`);

    this.logger.log(`User ${userId} connected to notifications`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (!userId) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    this.logger.log(`User ${userId} disconnected from notifications`);
  }

  /**
   * Send a real-time notification to a specific user.
   * Called from NotificationsService after persisting the notification.
   */
  sendNotificationToUser(userId: string, notification: Notification): void {
    this.server.to(`user_${userId}`).emit('newNotification', {
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      entityId: notification.entityId,
      entityType: notification.entityType,
      createdAt: notification.createdAt,
      actor: notification.actor,
    });
  }

  /**
   * Send updated unread count to a user (after new notification or mark read).
   */
  sendUnreadCount(userId: string, count: number): void {
    this.server.to(`user_${userId}`).emit('unreadCount', { count });
  }
}
