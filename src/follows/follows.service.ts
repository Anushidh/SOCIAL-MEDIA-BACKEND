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
import { FollowRequest } from './entities/follow-request.entity';
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
    @InjectRepository(FollowRequest)
    private readonly followRequestsRepository: Repository<FollowRequest>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Follow / Unfollow ─────────────────────────────────────────────────────

  async follow(followerId: string, followingId: string): Promise<any> {
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

    if (targetUser.isPrivate) {
      const existingRequest = await this.followRequestsRepository.findOne({
        where: { requesterId: followerId, targetId: followingId },
      });
      if (existingRequest) throw new ConflictException('Follow request already sent');

      const request = this.followRequestsRepository.create({ requesterId: followerId, targetId: followingId });
      await this.followRequestsRepository.save(request);

      await this.notificationsService.create({
        type: NotificationType.FOLLOW_REQUEST,
        actorId: followerId,
        recipientId: followingId,
        entityId: followerId,
        entityType: 'user',
      });
      return { requested: true };
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

    if (follow) {
      await this.followsRepository.remove(follow);
      return;
    }

    const request = await this.followRequestsRepository.findOne({
      where: { requesterId: followerId, targetId: followingId },
    });

    if (request) {
      await this.followRequestsRepository.remove(request);
      return;
    }

    throw new NotFoundException('Follow relationship not found');
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
    viewerId?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<any>> {
    const targetUser = await this.usersRepository.findOne({ where: { id: userId }});
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.isPrivate && viewerId !== userId) {
      const follow = await this.followsRepository.findOne({ where: { followerId: viewerId, followingId: userId } });
      if (!follow) throw new ForbiddenException('Cannot view followers of a private account you do not follow');
    }

    const [followers, total] = await this.followsRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const data = await this.attachViewerFollowingState(
      followers.map((f) => f.follower),
      viewerId,
    );

    // Re-wrap with original structure
    const enriched = followers.map((f, i) => ({ ...f, follower: data[i] }));
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  async getFollowing(
    userId: string,
    viewerId?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<any>> {
    const targetUser = await this.usersRepository.findOne({ where: { id: userId }});
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.isPrivate && viewerId !== userId) {
      const follow = await this.followsRepository.findOne({ where: { followerId: viewerId, followingId: userId } });
      if (!follow) throw new ForbiddenException('Cannot view following of a private account you do not follow');
    }

    const [following, total] = await this.followsRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const data = await this.attachViewerFollowingState(
      following.map((f) => f.following),
      viewerId,
    );

    const enriched = following.map((f, i) => ({ ...f, following: data[i] }));
    return new PaginatedResponseDto(enriched, total, page, limit);
  }

  /** Attaches isFollowing flag to each user based on whether viewerId follows them */
  private async attachViewerFollowingState(users: User[], viewerId?: string): Promise<any[]> {
    if (!viewerId || !users.length) {
      return users.map((u) => ({ ...u, isFollowing: false, isRequested: false }));
    }

    const userIds = users.map((u) => u.id);
    const existingFollows = await this.followsRepository.find({
      where: userIds.map((id) => ({ followerId: viewerId, followingId: id })),
      select: ['followingId'],
    });
    const existingRequests = await this.followRequestsRepository.find({
      where: userIds.map((id) => ({ requesterId: viewerId, targetId: id })),
      select: ['targetId'],
    });

    const followingSet = new Set(existingFollows.map((f) => f.followingId));
    const requestedSet = new Set(existingRequests.map((r) => r.targetId));
    
    return users.map((u) => ({ 
      ...u, 
      isFollowing: followingSet.has(u.id),
      isRequested: requestedSet.has(u.id)
    }));
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

  async isFollowing(followerId: string, followingId: string): Promise<{ isFollowing: boolean, isRequested: boolean }> {
    const follow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });
    const request = await this.followRequestsRepository.findOne({
      where: { requesterId: followerId, targetId: followingId },
    });
    return { isFollowing: !!follow, isRequested: !!request };
  }

  async getFollowersCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followingId: userId } });
  }

  async getFollowingCount(userId: string): Promise<number> {
    return this.followsRepository.count({ where: { followerId: userId } });
  }

  // ─── Follow Requests ───────────────────────────────────────────────────────

  async getFollowRequests(userId: string, page = 1, limit = 20): Promise<PaginatedResponseDto<any>> {
    const [requests, total] = await this.followRequestsRepository.findAndCount({
      where: { targetId: userId },
      relations: ['requester'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    
    return new PaginatedResponseDto(requests, total, page, limit);
  }

  async acceptFollowRequest(requesterId: string, userId: string): Promise<Follow> {
    const request = await this.followRequestsRepository.findOne({
      where: { requesterId, targetId: userId },
    });
    if (!request) throw new NotFoundException('Follow request not found');

    const follow = this.followsRepository.create({ followerId: request.requesterId, followingId: request.targetId });
    const savedFollow = await this.followsRepository.save(follow);
    
    await this.followRequestsRepository.remove(request);

    await this.notificationsService.create({
      type: NotificationType.FOLLOW,
      actorId: request.requesterId,
      recipientId: request.targetId,
      entityId: request.requesterId,
      entityType: 'user',
    });

    return savedFollow;
  }

  async denyFollowRequest(requesterId: string, userId: string): Promise<void> {
    const request = await this.followRequestsRepository.findOne({
      where: { requesterId, targetId: userId },
    });
    if (!request) throw new NotFoundException('Follow request not found');
    await this.followRequestsRepository.remove(request);
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
    
    // Remove requests
    await this.followRequestsRepository.delete({ requesterId: blockerId, targetId: blockedId });
    await this.followRequestsRepository.delete({ requesterId: blockedId, targetId: blockerId });

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