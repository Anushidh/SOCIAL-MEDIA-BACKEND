import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { CreateStoryDto } from './dto';
import { Follow } from '../follows/entities/follow.entity';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storiesRepository: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly storyViewsRepository: Repository<StoryView>,
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
  ) {}

  async create(authorId: string, createStoryDto: CreateStoryDto): Promise<Story> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = this.storiesRepository.create({
      ...createStoryDto,
      authorId,
      expiresAt,
    });

    return this.storiesRepository.save(story);
  }

  /**
   * Get stories from followed users (not expired).
   */
  async getFeedStories(userId: string): Promise<any[]> {
    const follows = await this.followsRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followingIds = follows.map((f) => f.followingId);
    followingIds.push(userId); // Include own stories

    if (followingIds.length === 0) {
      return [];
    }

    const now = new Date();

    const stories = await this.storiesRepository
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.author', 'author')
      .where('story.authorId IN (:...followingIds)', { followingIds })
      .andWhere('story.expiresAt > :now', { now })
      .orderBy('story.createdAt', 'DESC')
      .getMany();

    // Group by author
    const grouped = new Map<string, any>();
    for (const story of stories) {
      const authorId = story.authorId;
      if (!grouped.has(authorId)) {
        grouped.set(authorId, {
          user: story.author,
          stories: [],
        });
      }
      grouped.get(authorId)!.stories.push(story);
    }

    return [...grouped.values()];
  }

  /**
   * Get a single user's active stories.
   */
  async getUserStories(userId: string): Promise<Story[]> {
    const now = new Date();
    return this.storiesRepository.find({
      where: { authorId: userId, expiresAt: MoreThan(now) },
      order: { createdAt: 'ASC' },
      relations: ['author'],
    });
  }

  /**
   * View a story (records the view).
   */
  async viewStory(storyId: string, viewerId: string): Promise<void> {
    const story = await this.storiesRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (new Date() > story.expiresAt) {
      throw new NotFoundException('Story has expired');
    }

    // Don't count own views
    if (story.authorId === viewerId) {
      return;
    }

    const existingView = await this.storyViewsRepository.findOne({
      where: { viewerId, storyId },
    });

    if (!existingView) {
      const view = this.storyViewsRepository.create({ viewerId, storyId });
      await this.storyViewsRepository.save(view);
      await this.storiesRepository.increment({ id: storyId }, 'viewsCount', 1);
    }
  }

  /**
   * Get viewers of a story (only story author can see this).
   */
  async getStoryViewers(
    storyId: string,
    userId: string,
  ): Promise<StoryView[]> {
    const story = await this.storiesRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.authorId !== userId) {
      throw new ForbiddenException('Only the story author can see viewers');
    }

    return this.storyViewsRepository.find({
      where: { storyId },
      relations: ['viewer'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete own story.
   */
  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await this.storiesRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    await this.storiesRepository.remove(story);
  }
}
