import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { User } from '../users/entities/user.entity';

const storyStorage = diskStorage({
  destination: './uploads/stories',
  filename: (_req, file, callback) => {
    const uniqueName = `story_${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

@ApiTags('Stories')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a story (text + image URL)' })
  create(@CurrentUser() user: User, @Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.create(user.id, createStoryDto);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Create a story with image upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: storyStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createWithUpload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
  ) {
    if (!file) {
      throw new BadRequestException('Image is required for a story');
    }

    const imageUrl = this.mediaService.getFileUrl(`stories/${file.filename}`);
    return this.storiesService.create(user.id, {
      imageUrl,
      caption: body.caption,
    });
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get stories from followed users (grouped by user)' })
  getFeedStories(@CurrentUser() user: User) {
    return this.storiesService.getFeedStories(user.id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get active stories of a specific user' })
  getUserStories(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.storiesService.getUserStories(userId);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a story as viewed' })
  viewStory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.storiesService.viewStory(id, user.id);
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'Get story viewers (author only)' })
  getViewers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.storiesService.getStoryViewers(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own story' })
  deleteStory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.storiesService.deleteStory(id, user.id);
  }
}
