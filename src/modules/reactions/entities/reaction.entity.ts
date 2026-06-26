import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Post } from '@modules/posts/entities/post.entity';
import { User } from '@modules/users/entities/user.entity';

export type ReactionType = 'LIKE';

/** Reacción a una publicación. MVP: solo LIKE. Único por (post,user). */
@Entity('reactions')
@Unique('uq_reaction_post_user', ['postId', 'userId'])
export class Reaction {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_reactions_post')
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ApiProperty({ enum: ['LIKE'], default: 'LIKE' })
  @Column({ type: 'varchar', length: 10, default: 'LIKE' })
  type: ReactionType;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
