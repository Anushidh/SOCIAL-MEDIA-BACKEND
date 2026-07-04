import {
  Controller,
  Get,
  Post as HttpPost,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { RepostsService } from './reposts.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { User } from '../users/entities/user.entity';

const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: any,
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new BadRequestException('Only image files are allowed'), false);
  }
};

@ApiTags('Posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly repostsService: RepostsService,
    private readonly mediaService: MediaService,
  ) {}

  @HttpPost()
  @ApiOperation({ summary: 'Create a new post (text only)' })
  create(@CurrentUser() user: User, @Body() createPostDto: CreatePostDto) {
    return this.postsService.create(user.id, createPostDto);
  }

  @HttpPost('with-images')
  @ApiOperation({ summary: 'Create a post with image uploads (max 10)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createWithImages(
    @CurrentUser() user: User,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const imageUrls = files?.length
      ? await this.mediaService.uploadFiles(files, 'posts')
      : [];

    return this.postsService.create(user.id, {
      ...createPostDto,
      imageUrls,
    });
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get personalized feed (posts from followed users)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFeed(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getFeed(user.id, page, limit);
  }

  @Get('explore')
  @ApiOperation({ summary: 'Get explore/discover posts (trending)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getExplore(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getExplore(user.id, page, limit);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search posts by content' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  searchPosts(
    @CurrentUser() user: User,
    @Query('q') q: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.searchPosts(q, user.id, page, limit);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'Get bookmarked/saved posts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getBookmarks(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getBookmarks(user.id, page, limit);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get posts by user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getUserPosts(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getUserPosts(userId, user.id, page, limit);
  }

  @Get('user/:userId/reposts')
  @ApiOperation({ summary: "Get posts a user has reposted (for their profile)" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getUserReposts(
    @CurrentUser() viewer: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.repostsService.getUserReposts(userId, viewer.id, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID with comments' })
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findByIdWithComments(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update own post' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.id, updatePostDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own post' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.remove(id, user.id);
  }

  // ─── Bookmarks ─────────────────────────────────────────────────────────────

  @HttpPost(':id/bookmark')
  @ApiOperation({ summary: 'Bookmark/save a post' })
  bookmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.postsService.bookmarkPost(user.id, id);
  }

  @Delete(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove bookmark from a post' })
  removeBookmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.postsService.removeBookmark(user.id, id);
  }

  @Get(':id/bookmark/status')
  @ApiOperation({ summary: 'Check if post is bookmarked' })
  isBookmarked(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.postsService.isBookmarked(user.id, id);
  }
}
