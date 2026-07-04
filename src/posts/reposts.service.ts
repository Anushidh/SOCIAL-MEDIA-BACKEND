import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Repost } from './entities/repost.entity';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { Follow } from '../follows/entities/follow.entity';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class RepostsService {
  constructor(
    @InjectRepository(Repost)
    private readonly repostsRepository: Repository<Repost>,
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
  ) {}

  async repost(userId: string, postId: string): Promise<Repost> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId === userId) {
      throw new ForbiddenException('You cannot repost your own post');
    }

    const existing = await this.repostsRepository.findOne({
      where: { userId, postId },
    });

    if (existing) {
      throw new ConflictException('You already reposted this');
    }

    const repost = this.repostsRepository.create({ userId, postId });
    const saved = await this.repostsRepository.save(repost);

    await this.postsRepository.increment({ id: postId }, 'repostsCount', 1);

    return saved;
  }

  async removeRepost(userId: string, postId: string): Promise<void> {
    const repost = await this.repostsRepository.findOne({
      where: { userId, postId },
    });

    if (!repost) {
      throw new NotFoundException('Repost not found');
    }

    await this.repostsRepository.remove(repost);
    await this.postsRepository.decrement({ id: postId }, 'repostsCount', 1);
  }

  async getRepostsByPost(
    postId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Repost>> {
    const [reposts, total] = await this.repostsRepository.findAndCount({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(reposts, total, page, limit);
  }

  /** Posts that a user has reposted — used on their profile "Reposts" tab */
  async getUserReposts(
    userId: string,
    viewerId?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Post>> {
    const targetUser = await this.usersRepository.findOne({ where: { id: userId } });
    if (!targetUser) throw new NotFoundException('User not found');
    
    if (targetUser.isPrivate && viewerId !== userId) {
      if (!viewerId) throw new ForbiddenException('This account is private');
      const isFollowing = await this.followsRepository.findOne({ where: { followerId: viewerId, followingId: userId }});
      if (!isFollowing) throw new ForbiddenException('This account is private');
    }

    const [reposts, total] = await this.repostsRepository.findAndCount({
      where: { userId },
      relations: ['post', 'post.author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const posts = reposts.map((r) => r.post).filter(Boolean);

    if (viewerId && posts.length) {
      // Reuse PostsService.attachUserState — but we only have the repository here,
      // so inline the same logic to avoid a circular dependency
      const postIds = posts.map((p) => p.id);
      const [likes, bookmarks, reposteds] = await Promise.all([
        this.repostsRepository.manager
          .getRepository('likes')
          .find({ where: { userId: viewerId }, select: ['postId'] })
          .catch(() => []),
        this.repostsRepository.manager
          .getRepository('bookmarks')
          .find({ where: { userId: viewerId }, select: ['postId'] })
          .catch(() => []),
        this.repostsRepository.find({
          where: { userId: viewerId },
          select: ['postId'],
        }),
      ]);

      const likedIds = new Set((likes as any[]).filter((l) => postIds.includes(l.postId)).map((l) => l.postId));
      const bookmarkedIds = new Set((bookmarks as any[]).filter((b) => postIds.includes(b.postId)).map((b) => b.postId));
      const repostedIds = new Set(reposteds.filter((r) => postIds.includes(r.postId)).map((r) => r.postId));

      const enriched = posts.map((p) => ({
        ...p,
        isLiked: likedIds.has(p.id),
        isBookmarked: bookmarkedIds.has(p.id),
        isReposted: repostedIds.has(p.id),
      }));

      return new PaginatedResponseDto(enriched, total, page, limit);
    }

    return new PaginatedResponseDto(posts, total, page, limit);
  }

  async hasReposted(userId: string, postId: string): Promise<{ reposted: boolean }> {
    const repost = await this.repostsRepository.findOne({
      where: { userId, postId },
    });
    return { reposted: !!repost };
  }
}
