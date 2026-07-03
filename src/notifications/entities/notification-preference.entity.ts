import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'like_enabled', default: true })
  likeEnabled: boolean;

  @Column({ name: 'comment_enabled', default: true })
  commentEnabled: boolean;

  @Column({ name: 'follow_enabled', default: true })
  followEnabled: boolean;

  @Column({ name: 'message_enabled', default: true })
  messageEnabled: boolean;

  @Column({ name: 'mention_enabled', default: true })
  mentionEnabled: boolean;
}
