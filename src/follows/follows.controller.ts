import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Follows')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  // ─── Follow / Unfollow ─────────────────────────────────────────────────────

  @Post(':userId/follow')
  @ApiOperation({ summary: 'Follow a user' })
  follow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.follow(user.id, userId);
  }

  @Delete(':userId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.unfollow(user.id, userId);
  }

  @Delete(':userId/followers')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a follower' })
  removeFollower(
    @Param('userId', ParseUUIDPipe) followerId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.removeFollower(user.id, followerId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get followers of a user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFollowers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.followsService.getFollowers(userId, page, limit);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get users that a user follows' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.followsService.getFollowing(userId, page, limit);
  }

  @Get(':userId/mutual-followers')
  @ApiOperation({ summary: 'Get mutual followers with a user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMutualFollowers(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.followsService.getMutualFollowers(user.id, targetUserId, page, limit);
  }

  @Get(':userId/follow/status')
  @ApiOperation({ summary: 'Check if current user follows a user' })
  isFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.isFollowing(user.id, userId);
  }

  // ─── Block / Unblock ───────────────────────────────────────────────────────

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user (removes follow relationships)' })
  blockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.blockUser(user.id, userId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.unblockUser(user.id, userId);
  }

  @Get('me/blocked')
  @ApiOperation({ summary: 'Get list of blocked users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getBlockedUsers(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.followsService.getBlockedUsers(user.id, page, limit);
  }

  @Get(':userId/block/status')
  @ApiOperation({ summary: 'Check if a block exists between current user and target' })
  isBlocked(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.followsService.isBlocked(user.id, userId);
  }
}
