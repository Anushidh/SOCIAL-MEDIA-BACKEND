import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { username, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getProfile(username: string): Promise<any> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .loadRelationCountAndMap('user.followersCount', 'user.followers')
      .loadRelationCountAndMap('user.followingCount', 'user.following')
      .loadRelationCountAndMap('user.postsCount', 'user.posts')
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive fields
    const { password, oauthProvider, oauthProviderId, ...profile } = user as any;
    return profile;
  }

  async update(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);

    // Only assign defined properties to avoid overwriting with undefined
    Object.keys(updateUserDto).forEach((key) => {
      if (updateUserDto[key as keyof UpdateUserDto] !== undefined) {
        (user as any)[key] = updateUserDto[key as keyof UpdateUserDto];
      }
    });

    return this.usersRepository.save(user);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(userId);
    user.avatarUrl = avatarUrl;
    return this.usersRepository.save(user);
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for OAuth accounts. Please set a password first.',
      );
    }

    const isCurrentValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(changePasswordDto.newPassword, salt);
    await this.usersRepository.save(user);
  }

  async search(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<User>> {
    const [users, total] = await this.usersRepository.findAndCount({
      where: [
        { username: ILike(`%${query}%`), isActive: true },
        { displayName: ILike(`%${query}%`), isActive: true },
      ],
      take: limit,
      skip: (page - 1) * limit,
      order: { username: 'ASC' },
    });

    return new PaginatedResponseDto(users, total, page, limit);
  }

  async getSuggestedUsers(currentUserId: string, limit = 5): Promise<PaginatedResponseDto<User>> {
    // Return active users that the current user is NOT following
    // Ordered by newest first so new members appear as suggestions
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere('user.id != :currentUserId', { currentUserId })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('follow.followingId')
          .from('follows', 'follow')
          .where('follow.followerId = :currentUserId', { currentUserId })
          .getQuery();
        return `user.id NOT IN ${subQuery}`;
      })
      .orderBy('user.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return new PaginatedResponseDto(users, users.length, 1, limit);
  }

  async deactivate(userId: string): Promise<void> {
    const user = await this.findById(userId);
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user has a password (non-OAuth), verify it
    if (user.password && password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw new BadRequestException('Invalid password');
      }
    }

    // Soft delete - deactivate and anonymize
    user.isActive = false;
    user.email = `deleted_${user.id}@removed.local`;
    user.username = `deleted_${user.id.substring(0, 8)}`;
    user.displayName = 'Deleted User';
    user.bio = null as any;
    user.avatarUrl = null as any;
    await this.usersRepository.save(user);
  }
}
