import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'views_count', default: 0 })
  viewsCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
