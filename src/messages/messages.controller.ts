import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto, CreateConversationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // ─── Conversations ─────────────────────────────────────────────────────────

  @Post('conversations')
  @ApiOperation({ summary: 'Create or get existing conversation with a user' })
  createConversation(
    @CurrentUser() user: User,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.messagesService.createConversation(
      user.id,
      createConversationDto,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations with last message and unread count' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getConversations(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.getUserConversations(user.id, page, limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count across all conversations' })
  getUnreadCount(@CurrentUser() user: User) {
    return this.messagesService.getUnreadCount(user.id);
  }

  @Get('conversations/:conversationId')
  @ApiOperation({ summary: 'Get messages in a conversation (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.getMessages(conversationId, user.id, page, limit);
  }

  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation and all its messages' })
  deleteConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.deleteConversation(conversationId, user.id);
  }

  @Patch('conversations/:conversationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  markAsRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.markAsRead(conversationId, user.id);
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @CurrentUser() user: User,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(user.id, createMessageDto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own message' })
  deleteMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.deleteMessage(messageId, user.id);
  }
}
