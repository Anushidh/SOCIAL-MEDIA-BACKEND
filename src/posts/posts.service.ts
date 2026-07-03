import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Post } from './entities/post.entity';
import { Bookmark } from './entities/bookmark.entity';
import { Repost } from './entities/repost.entity';
import { Like } from '../likes/entities/like.entity';
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
    @InjectRepository(Repost)
    private readonly repostsRepository: Repository<Repost>,
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    private readonly hashtagsService: HashtagsService,
    private readonly mentionsService: MentionsService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Attach isLiked / isBookmarked / isReposted to a list of posts for a given user */
  async attachUserState(posts: Post[], userId: string): Promise<Post[]> {
    if (!posts.length) return posts;

    const postIds = posts.map((p) => p.id);

    const [likes, bookmarks, reposts] = await Promise.all([
      this.likesRepository.find({ where: { userId, postId: In(postIds) }, select: ['postId'] }),
      this.bookmarksRepository.find({ where: { userId, postId: In(postIds) }, select: ['postId'] }),
      this.repostsRepository.find({ where: { userId, postId: In(postIds) }, select: ['postId'] }),
    ]);

    const likedIds = new Set(likes.map((l) => l.postId));
    const bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
    const repostedIds = new Set(reposts.map((r) => r.postId));

    return posts.map((p) => ({
      ...p,
      isLiked: likedIds.has(p.id),
      isBookmarked: bookmarkedIds.has(p.id),
      isReposted: repostedIds.has(p.id),
    }));
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(authorId: string, createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({ ...createPostDto, authorId });
    const saved = await this.postsRepository.save(post);

    await this.hashtagsService.processPostHashtags(saved);
    await this.mentionsService.processMentions(saved.content, authorId, saved.id, 'post');

    return this.postsRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['author'],
    });
  }

  async findById(id: string, userId?: string): Promise<Post & { isLiked?: boolean; isBookmarked?: boolean; isReposted?: boolean }> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!post) throw new NotFoundException('Post not found');

    if (userId) {
      const [posts] = await Promise.all([this.attachUserState([post], userId)]);
      return posts[0];
    }

    return post;
  }

  async findByIdWithComments(id: string, userId?: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'comments', 'comments.author', 'comments.replies', 'comments.replies.author'],
    });

    if (!post) throw new NotFoundException('Post not found');

    post.comments = post.comments.filter((c) => !c.parentId);

    if (userId) {
      const [enriched] = await this.attachUserState([post], userId);
      return enriched;
    }

    return post;
  }

  async getFeed(userId: string, page = 1, limit = 20): Promise<PaginatedResponseDto<Post>> {
    const follows = await this.followsRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followingIds = follows.map((f) => f.followingId);
    followingIds.push(userId);

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId IN (:...followingIds)', { followingIds })
      .orderBy('post.createdAt', 'DESC');

    const total = await qb.getCount();
    const posts = await qb.skip((page - 1) * limit).take(limit).getMany();
    const enriched = await this.attachUserState(posts, userId);

    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async getExplore(userId?: string, page = 1, limit = 20): Promise<PaginatedResponseDto<Post>> {
    const [posts, total] = await this.postsRepository.findAndCount({
      relations: ['author'],
      order: { likesCount: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const enriched = userId ? await this.attachUserState(posts, userId) : posts;
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async getUserPosts(userId: string, viewerId?: string, page = 1, limit = 20): Promise<PaginatedResponseDto<Post>> {
    const [posts, total] = await this.postsRepository.findAndCount({
      where: { authorId: userId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const enriched = viewerId ? await this.attachUserState(posts, viewerId) : posts;
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async searchPosts(query: string, userId?: string, page = 1, limit = 20): Promise<PaginatedResponseDto<Post>> {
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.content ILIKE :query', { query: `%${query}%` })
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();
    const enriched = userId ? await this.attachUserState(posts, userId) : posts;
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async update(id: string, userId: string, updatePostDto: UpdatePostDto): Promise<Post> {
    const post = await this.findById(id);
    if (post.authorId !== userId) throw new ForbiddenException('You can only edit your own posts');
    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findById(id);
    if (post.authorId !== userId) throw new ForbiddenException('You can only delete your own posts');
    await this.postsRepository.remove(post);
  }

  // ─── Bookmarks ─────────────────────────────────────────────────────────────

  async bookmarkPost(userId: string, postId: string): Promise<Bookmark> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.bookmarksRepository.findOne({ where: { userId, postId } });
    if (existing) throw new ConflictException('Post already bookmarked');

    const bookmark = this.bookmarksRepository.create({ userId, postId });
    return this.bookmarksRepository.save(bookmark);
  }

  async removeBookmark(userId: string, postId: string): Promise<void> {
    const bookmark = await this.bookmarksRepository.findOne({ where: { userId, postId } });
    if (!bookmark) throw new NotFoundException('Bookmark not found');
    await this.bookmarksRepository.remove(bookmark);
  }

  async getBookmarks(userId: string, page = 1, limit = 20): Promise<PaginatedResponseDto<Post>> {
    const [bookmarks, total] = await this.bookmarksRepository.findAndCount({
      where: { userId },
      relations: ['post', 'post.author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const posts = bookmarks.map((b) => b.post);
    const enriched = await this.attachUserState(posts, userId);
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async isBookmarked(userId: string, postId: string): Promise<boolean> {
    const bookmark = await this.bookmarksRepository.findOne({ where: { userId, postId } });
    return !!bookmark;
  }
}
