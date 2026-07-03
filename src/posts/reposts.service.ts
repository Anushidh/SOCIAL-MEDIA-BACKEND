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
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class RepostsService {
  constructor(
    @InjectRepository(Repost)
    private readonly repostsRepository: Repository<Repost>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
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

  async hasReposted(userId: string, postId: string): Promise<{ reposted: boolean }> {
    const repost = await this.repostsRepository.findOne({
      where: { userId, postId },
    });
    return { reposted: !!repost };
  }
}
