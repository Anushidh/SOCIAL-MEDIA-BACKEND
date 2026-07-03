import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Story } from './story.entity';

@Entity('story_views')
@Unique(['viewerId', 'storyId'])
export class StoryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'viewer_id' })
  viewerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewer_id' })
  viewer: User;

  @Column({ name: 'story_id' })
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story: Story;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
