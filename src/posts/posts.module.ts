import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { HashtagsController } from './hashtags.controller';
import { HashtagsService } from './hashtags.service';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { RepostsController } from './reposts.controller';
import { RepostsService } from './reposts.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { MentionsService } from './mentions.service';
import { Post } from './entities/post.entity';
import { Bookmark } from './entities/bookmark.entity';
import { Hashtag } from './entities/hashtag.entity';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { Repost } from './entities/repost.entity';
import { Report } from './entities/report.entity';
import { Follow } from '../follows/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      Bookmark,
      Hashtag,
      Story,
      StoryView,
      Repost,
      Report,
      Follow,
      User,
    ]),
    MediaModule,
    NotificationsModule,
  ],
  controllers: [
    PostsController,
    HashtagsController,
    StoriesController,
    RepostsController,
    ReportsController,
  ],
  providers: [
    PostsService,
    HashtagsService,
    StoriesService,
    RepostsService,
    ReportsService,
    MentionsService,
  ],
  exports: [PostsService, HashtagsService, MentionsService],
})
export class PostsModule {}
