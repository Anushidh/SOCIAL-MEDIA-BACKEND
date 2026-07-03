import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Bookmark } from './entities/bookmark.entity';
import { CreatePostDto, UpdatePostDto } from './dto';
import { Follow } from '../follows/entities/follow.entity';
import { PaginatedResponseDto } from '../common/dto';
import { HashtagsService } from './hashtags.service';
import { MentionsService } from './mentions.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    @InjectRepository(Bookmark)
    private readonly bookmarksRepository: Repository<Bookmark>,
    private readonly hashtagsService: HashtagsService,
    private readonly mentionsService: MentionsService,
  ) {}

  async create(authorId: string, createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({
      ...createPostDto,
      authorId,
    });

    const saved = await this.postsRepository.save(post);

    // Process hashtags and mentions in background
    await this.hashtagsService.processPostHashtags(saved);
    await this.mentionsService.processMentions(
      saved.content,
      authorId,
      saved.id,
      'post',
    );

    return this.postsRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
  }

  async findById(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findByIdWithComments(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'comments', 'comments.author', 'comments.replies', 'comments.replies.author'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Filter to only top-level comments (parentId is null)
    post.comments = post.comments.filter((c) => !c.parentId);

    return post;
  }

  async getFeed(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Post>> {
    // Get IDs of users that the current user follows
    const follows = await this.followsRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followingIds = follows.map((f) => f.followingId);
    followingIds.push(userId); // Include own posts in feed

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId IN (:...followingIds)', { followingIds })
      .orderBy('post.createdAt', 'DESC');

    const total = await qb.getCount();
    const posts = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return new PaginatedResponseDto(posts, total, page, limit);
  }

  async getExplore(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Post>> {
    const [posts, total] = await this.postsRepository.findAndCount({
      relations: ['author'],
      order: { likesCount: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(posts, total, page, limit);
  }

  async getUserPosts(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Post>> {
    const [posts, total] = await this.postsRepository.findAndCount({
      where: { authorId: userId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(posts, total, page, limit);
  }

  async update(
    id: string,
    userId: string,
    updatePostDto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.findById(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findById(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postsRepository.remove(post);
  }

  // ─── Bookmarks ─────────────────────────────────────────────────────────────

  async bookmarkPost(userId: string, postId: string): Promise<Bookmark> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.bookmarksRepository.findOne({
      where: { userId, postId },
    });

    if (existing) {
      throw new ConflictException('Post already bookmarked');
    }

    const bookmark = this.bookmarksRepository.create({ userId, postId });
    return this.bookmarksRepository.save(bookmark);
  }

  async removeBookmark(userId: string, postId: string): Promise<void> {
    const bookmark = await this.bookmarksRepository.findOne({
      where: { userId, postId },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    await this.bookmarksRepository.remove(bookmark);
  }

  async getBookmarks(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Bookmark>> {
    const [bookmarks, total] = await this.bookmarksRepository.findAndCount({
      where: { userId },
      relations: ['post', 'post.author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(bookmarks, total, page, limit);
  }

  async isBookmarked(userId: string, postId: string): Promise<boolean> {
    const bookmark = await this.bookmarksRepository.findOne({
      where: { userId, postId },
    });
    return !!bookmark;
  }
}
