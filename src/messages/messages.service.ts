import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Conversation } from './entities/conversation.entity';
import { User } from '../users/entities/user.entity';
import { CreateMessageDto, CreateConversationDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createConversation(
    userId: string,
    createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    const participant = await this.usersRepository.findOne({
      where: { id: createConversationDto.participantId, isActive: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const currentUser = await this.usersRepository.findOneOrFail({
      where: { id: userId },
    });

    // Check if conversation already exists between these two users
    const existing = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'p1', 'p1.id = :userId', {
        userId,
      })
      .innerJoin(
        'conversation.participants',
        'p2',
        'p2.id = :participantId',
        { participantId: createConversationDto.participantId },
      )
      .leftJoinAndSelect('conversation.participants', 'p')
      .getOne();

    if (existing) {
      return existing;
    }

    const conversation = this.conversationsRepository.create();
    conversation.participants = [currentUser, participant];
    return this.conversationsRepository.save(conversation);
  }

  async getUserConversations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<any[]> {
    const conversations = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant')
      .where('participant.id = :userId', { userId })
      .leftJoinAndSelect('conversation.participants', 'p')
      .orderBy('conversation.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // For each conversation, get the last message and unread count
    const results = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messagesRepository.findOne({
          where: { conversationId: conv.id },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        // Count messages not sent by current user and not read
        const unread = await this.messagesRepository
          .createQueryBuilder('message')
          .where('message.conversationId = :convId', { convId: conv.id })
          .andWhere('message.senderId != :userId', { userId })
          .andWhere('message.isRead = :isRead', { isRead: false })
          .getCount();

        return {
          ...conv,
          lastMessage: lastMessage || null,
          unreadCount: unread,
        };
      }),
    );

    return results;
  }

  async sendMessage(
    senderId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: createMessageDto.conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.id === senderId,
    );
    if (!isParticipant) {
      throw new NotFoundException('Conversation not found');
    }

    const message = this.messagesRepository.create({
      content: createMessageDto.content,
      mediaUrl: createMessageDto.mediaUrl,
      mediaType: createMessageDto.mediaType,
      senderId,
      conversationId: createMessageDto.conversationId,
    });

    const saved = await this.messagesRepository.save(message);

    // Update conversation timestamp
    await this.conversationsRepository.update(conversation.id, {
      updatedAt: new Date(),
    });

    return this.messagesRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['sender'],
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponseDto<Message>> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.id === userId,
    );
    if (!isParticipant) {
      throw new NotFoundException('Conversation not found');
    }

    const [messages, total] = await this.messagesRepository.findAndCount({
      where: { conversationId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(messages, total, page, limit);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messagesRepository.remove(message);
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true, readAt: new Date() })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .innerJoin('conversation.participants', 'participant')
      .where('participant.id = :userId', { userId })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.isRead = :isRead', { isRead: false })
      .getCount();

    return { count };
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.id === userId,
    );
    if (!isParticipant) {
      throw new NotFoundException('Conversation not found');
    }

    // Delete all messages in the conversation
    await this.messagesRepository.delete({ conversationId });
    await this.conversationsRepository.remove(conversation);
  }
}
