import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HashtagsService } from './hashtags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Hashtags')
@Controller('hashtags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get('trending')
  @ApiOperation({ summary: 'Get trending hashtags' })
  @ApiQuery({ name: 'limit', required: false })
  getTrending(@Query('limit') limit?: number) {
    return this.hashtagsService.getTrending(limit);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search hashtags by prefix' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.hashtagsService.searchHashtags(query, limit);
  }

  @Get(':name/posts')
  @ApiOperation({ summary: 'Get posts by hashtag' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPostsByHashtag(
    @Param('name') name: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.hashtagsService.getPostsByHashtag(name, page, limit);
  }
}
