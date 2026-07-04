import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hashtag } from './entities/hashtag.entity';
import { Post } from './entities/post.entity';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class HashtagsService {
  constructor(
    @InjectRepository(Hashtag)
    private readonly hashtagsRepository: Repository<Hashtag>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  /**
   * Extract hashtags from post content and link them.
   * Called automatically when a post is created/updated.
   */
  async processPostHashtags(post: Post): Promise<void> {
    const hashtagNames = this.extractHashtags(post.content);

    if (hashtagNames.length === 0) {
      return;
    }

    const hashtags: Hashtag[] = [];

    for (const name of hashtagNames) {
      let hashtag = await this.hashtagsRepository.findOne({
        where: { name },
      });

      if (!hashtag) {
        hashtag = this.hashtagsRepository.create({ name, postsCount: 0 });
        hashtag = await this.hashtagsRepository.save(hashtag);
      }

      // Increment count
      await this.hashtagsRepository.increment({ id: hashtag.id }, 'postsCount', 1);
      hashtags.push(hashtag);
    }

    // Link hashtags to post
    post.hashtags = hashtags;
    await this.postsRepository.save(post);
  }

  /**
   * Remove hashtag associations when a post is deleted.
   */
  async removePostHashtags(post: Post): Promise<void> {
    if (!post.hashtags || post.hashtags.length === 0) {
      return;
    }

    for (const hashtag of post.hashtags) {
      await this.hashtagsRepository.decrement({ id: hashtag.id }, 'postsCount', 1);
    }
  }

  /**
   * Get trending hashtags (ordered by post count).
   */
  async getTrending(limit = 20): Promise<Hashtag[]> {
    return this.hashtagsRepository.find({
      where: {},
      order: { postsCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get posts by hashtag name.
   */
  async getPostsByHashtag(
    name: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Post>> {
    const normalizedName = name.toLowerCase().replace(/^#/, '');

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .innerJoin('post.hashtags', 'hashtag', 'hashtag.name = :name', {
        name: normalizedName,
      })
      .leftJoinAndSelect('post.author', 'author')
      .andWhere('author.isPrivate = :isPrivate', { isPrivate: false })
      .orderBy('post.createdAt', 'DESC');

    const total = await qb.getCount();
    const posts = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return new PaginatedResponseDto(posts, total, page, limit);
  }

  /**
   * Search hashtags by prefix.
   */
  async searchHashtags(query: string, limit = 10): Promise<Hashtag[]> {
    const normalized = query.toLowerCase().replace(/^#/, '');
    return this.hashtagsRepository
      .createQueryBuilder('hashtag')
      .where('hashtag.name LIKE :query', { query: `${normalized}%` })
      .orderBy('hashtag.postsCount', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Extract #hashtags from text content.
   */
  private extractHashtags(content: string): string[] {
    const regex = /#([a-zA-Z0-9_]+)/g;
    const matches = content.match(regex);

    if (!matches) {
      return [];
    }

    // Normalize: lowercase, remove #, deduplicate
    const unique = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
    return unique.slice(0, 30); // Limit to 30 hashtags per post
  }
}
