import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    postId: string,
    authorId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Validate parent comment exists if replying
    if (createCommentDto.parentId) {
      const parent = await this.commentsRepository.findOne({
        where: { id: createCommentDto.parentId, postId },
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }

      // Notify the parent comment author of the reply
      await this.notificationsService.create({
        type: NotificationType.COMMENT,
        actorId: authorId,
        recipientId: parent.authorId,
        entityId: postId,
        entityType: 'comment',
      });
    } else {
      // Notify the post author of the new comment
      await this.notificationsService.create({
        type: NotificationType.COMMENT,
        actorId: authorId,
        recipientId: post.authorId,
        entityId: postId,
        entityType: 'post',
      });
    }

    const comment = this.commentsRepository.create({
      ...createCommentDto,
      postId,
      authorId,
    });

    const savedComment = await this.commentsRepository.save(comment);

    // Increment post comment count
    await this.postsRepository.increment({ id: postId }, 'commentsCount', 1);

    return this.commentsRepository.findOneOrFail({
      where: { id: savedComment.id },
      relations: ['author'],
    });
  }

  async findByPost(
    postId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Comment>> {
    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { postId, parentId: IsNull() },
      relations: ['author', 'replies', 'replies.author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(comments, total, page, limit);
  }

  async getReplies(
    commentId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Comment>> {
    const [replies, total] = await this.commentsRepository.findAndCount({
      where: { parentId: commentId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(replies, total, page, limit);
  }

  async update(
    id: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = updateCommentDto.content;
    return this.commentsRepository.save(comment);
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Count this comment + its replies for the decrement
    const repliesCount = await this.commentsRepository.count({
      where: { parentId: id },
    });

    await this.commentsRepository.remove(comment);

    // Decrement post comment count (comment + its replies)
    await this.postsRepository.decrement(
      { id: comment.postId },
      'commentsCount',
      1 + repliesCount,
    );
  }
}
