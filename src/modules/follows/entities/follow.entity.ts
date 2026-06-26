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
import { User } from '@modules/users/entities/user.entity';

/** Relación de seguimiento (followerId sigue a followingId). */
@Entity('follows')
@Unique('uq_follow_pair', ['followerId', 'followingId'])
export class Follow {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_follows_follower')
  @Column({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower?: User;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_follows_following')
  @Column({ name: 'following_id', type: 'uuid' })
  followingId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following?: User;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
