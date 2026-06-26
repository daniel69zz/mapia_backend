import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from '@modules/posts/entities/post.entity';

export type MediaType = 'IMAGE' | 'VIDEO';

/** Multimedia asociada a una publicación. */
@Entity('post_media')
export class PostMedia {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_post_media_post')
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, (post) => post.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500 })
  url: string;

  @ApiProperty({ enum: ['IMAGE', 'VIDEO'] })
  @Column({ type: 'varchar', length: 10 })
  type: MediaType;

  @ApiProperty()
  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
