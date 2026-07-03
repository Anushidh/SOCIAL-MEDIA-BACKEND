import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { PaginatedResponseDto } from '../common/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async like(userId: string, postId: string): Promise<Like> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.likesRepository.findOne({
      where: { userId, postId },
    });

    if (existingLike) {
      throw new ConflictException('You already liked this post');
    }

    const like = this.likesRepository.create({ userId, postId });
    const savedLike = await this.likesRepository.save(like);

    // Increment like count
    await this.postsRepository.increment({ id: postId }, 'likesCount', 1);

    // Create notification for post author
    await this.notificationsService.create({
      type: NotificationType.LIKE,
      actorId: userId,
      recipientId: post.authorId,
      entityId: postId,
      entityType: 'post',
    });

    return savedLike;
  }

  async unlike(userId: string, postId: string): Promise<void> {
    const like = await this.likesRepository.findOne({
      where: { userId, postId },
    });

    if (!like) {
      throw new NotFoundException('Like not found');
    }

    await this.likesRepository.remove(like);

    // Decrement like count
    await this.postsRepository.decrement({ id: postId }, 'likesCount', 1);
  }

  async getLikesByPost(
    postId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Like>> {
    const [likes, total] = await this.likesRepository.findAndCount({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(likes, total, page, limit);
  }

  async hasUserLiked(userId: string, postId: string): Promise<{ liked: boolean }> {
    const like = await this.likesRepository.findOne({
      where: { userId, postId },
    });
    return { liked: !!like };
  }
}
