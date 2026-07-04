import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
  namespace: '/chat',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  // Track online users: userId -> Set of socket IDs (supports multiple tabs)
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  private getUserId(client: Socket): string | null {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      return payload.sub;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    // Store verified userId on socket for later use
    client.data.userId = userId;

    // Add socket to user's set
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(client.id);

    // Broadcast online status (only if this is their first connection)
    if (this.onlineUsers.get(userId)!.size === 1) {
      this.server.emit('userOnline', { userId, timestamp: new Date() });
    }

    this.logger.log(`User ${userId} connected (socket: ${client.id})`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    const userSockets = this.onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);

      // Only mark offline if no remaining connections
      if (userSockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.server.emit('userOffline', { userId, timestamp: new Date() });
      }
    }

    this.logger.log(`User ${userId} disconnected (socket: ${client.id})`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string; conversationId: string },
  ) {
    const userId = client.data?.userId as string;

    try {
      const message = await this.messagesService.sendMessage(userId, {
        content: data.content,
        conversationId: data.conversationId,
      });

      // Emit to all participants in the conversation room
      this.server.to(data.conversationId).emit('newMessage', message);

      // Also emit a notification event for users not in the room
      this.server.emit('messageNotification', {
        conversationId: data.conversationId,
        message,
      });

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(conversationId);
    this.logger.log(`Socket ${client.id} joined conversation ${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.leave(conversationId);
    return { success: true };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId as string;
    client.to(data.conversationId).emit('userTyping', {
      userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId as string;
    client.to(data.conversationId).emit('userStoppedTyping', {
      userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId as string;

    await this.messagesService.markAsRead(data.conversationId, userId);

    // Notify other participants that messages have been read
    client.to(data.conversationId).emit('messagesRead', {
      conversationId: data.conversationId,
      readBy: userId,
      readAt: new Date(),
    });

    return { success: true };
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    const onlineUserIds = [...this.onlineUsers.keys()];
    return { onlineUsers: onlineUserIds };
  }

  // Utility method: check if a user is online
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId) && this.onlineUsers.get(userId)!.size > 0;
  }

  // Utility method: get all online user IDs
  getOnlineUserIds(): string[] {
    return [...this.onlineUsers.keys()];
  }
}
