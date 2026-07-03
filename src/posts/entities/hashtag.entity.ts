import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Post } from './post.entity';

@Entity('hashtags')
export class Hashtag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ name: 'posts_count', default: 0 })
  postsCount: number;

  @ManyToMany(() => Post, (post) => post.hashtags)
  posts: Post[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
