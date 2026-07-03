import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { Block } from './entities/block.entity';
import { User } from '../users/entities/user.entity';
import { PaginatedResponseDto } from '../common/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Follow / Unfollow ─────────────────────────────────────────────────────

  async follow(followerId: string, followingId: string): Promise<Follow> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.usersRepository.findOne({
      where: { id: followingId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if blocked
    const blocked = await this.blocksRepository.findOne({
      where: [
        { blockerId: followingId, blockedId: followerId },
        { blockerId: followerId, blockedId: followingId },
      ],
    });

    if (blocked) {
      throw new ForbiddenException('Cannot follow this user');
    }

    const existingFollow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user');
    }

    const follow = this.followsRepository.create({ followerId, followingId });
    const savedFollow = await this.followsRepository.save(follow);

    // Notify the user they have a new follower
    await this.notificationsService.create({
      type: NotificationType.FOLLOW,
      actorId: followerId,
      recipientId: followingId,
      entityId: followerId,
      entityType: 'user',
    });

    return savedFollow;
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const follow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new NotFoundException('Follow relationship not found');
    }

    await this.followsRepository.remove(follow);
  }

  async removeFollower(userId: string, followerId: string): Promise<void> {
    const follow = await this.followsRepository.findOne({
      where: { followerId, followingId: userId },
    });

    if (!follow) {
      throw new NotFoundException('Follower not found');
    }

    await this.followsRepository.remove(follow);
  }

  async getFollowers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Follow>> {
    const [followers, total] = await this.followsRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(followers, total, page, limit);
  }

  async getFollowing(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Follow>> {
    const [following, total] = await this.followsRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(following, total, page, limit);
  }

  async getMutualFollowers(
    userId: string,
    targetUserId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<User>> {
    // Users that both userId and targetUserId follow
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(
        Follow,
        'f1',
        'f1.followingId = user.id AND f1.followerId = :userId',
        { userId },
      )
      .innerJoin(
        Follow,
        'f2',
        'f2.followingId = user.id AND f2.followerId = :targetUserId',
        { targetUserId },
      )
      .where('user.isActive = :isActive', { isActive: true });

    const total = await qb.getCount();
    const users = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return new PaginatedResponseDto(users, total, page, limit);
  }

  async isFollowing(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
    const follow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });
    return { isFollowing: !!follow };
  }

  async getFollowersCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followingId: userId } });
  }

  async getFollowingCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followerId: userId } });
  }

  // ─── Block / Unblock ───────────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<Block> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const targetUser = await this.usersRepository.findOne({
      where: { id: blockedId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existingBlock = await this.blocksRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existingBlock) {
      throw new ConflictException('User already blocked');
    }

    // Remove any follow relationships between the two users
    await this.followsRepository.delete({ followerId: blockerId, followingId: blockedId });
    await this.followsRepository.delete({ followerId: blockedId, followingId: blockerId });

    const block = this.blocksRepository.create({ blockerId, blockedId });
    return this.blocksRepository.save(block);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.blocksRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.blocksRepository.remove(block);
  }

  async getBlockedUsers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<Block>> {
    const [blocks, total] = await this.blocksRepository.findAndCount({
      where: { blockerId: userId },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return new PaginatedResponseDto(blocks, total, page, limit);
  }

  async isBlocked(userId: string, targetId: string): Promise<{ isBlocked: boolean }> {
    const block = await this.blocksRepository.findOne({
      where: [
        { blockerId: userId, blockedId: targetId },
        { blockerId: targetId, blockedId: userId },
      ],
    });
    return { isBlocked: !!block };
  }
}
