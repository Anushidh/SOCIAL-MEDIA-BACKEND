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
import { RepostsService } from './reposts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Reposts')
@Controller('posts/:postId/reposts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RepostsController {
  constructor(private readonly repostsService: RepostsService) {}

  @Post()
  @ApiOperation({ summary: 'Repost/share a post' })
  repost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ) {
    return this.repostsService.repost(user.id, postId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove repost' })
  removeRepost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ) {
    return this.repostsService.removeRepost(user.id, postId);
  }

  @Get()
  @ApiOperation({ summary: 'Get users who reposted' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getReposts(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.repostsService.getRepostsByPost(postId, page, limit);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if current user reposted' })
  hasReposted(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ) {
    return this.repostsService.hasReposted(user.id, postId);
  }
}
