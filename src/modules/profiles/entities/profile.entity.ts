import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';

/** Perfil social del usuario (1-1 con User). */
@Entity('profiles')
export class Profile extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ApiProperty()
  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName: string;

  @ApiProperty()
  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName: string;

  /** Nombre completo denormalizado (firstName + lastName). Lo usan map/alerts vía SQL. */
  @ApiProperty()
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40, unique: true })
  username: string;

  @ApiPropertyOptional({ example: '+59171234567' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @ApiProperty({ default: false })
  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 280, nullable: true })
  bio: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ description: 'storageKey del avatar (para borrado)' })
  @Column({ name: 'avatar_key', type: 'varchar', length: 500, nullable: true })
  avatarKey: string | null;

  @ApiProperty()
  @Column({ name: 'followers_count', type: 'int', default: 0 })
  followersCount: number;

  @ApiProperty()
  @Column({ name: 'following_count', type: 'int', default: 0 })
  followingCount: number;

  @ApiProperty()
  @Column({ name: 'posts_count', type: 'int', default: 0 })
  postsCount: number;

  @ApiProperty()
  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount: number;

  @ApiProperty()
  @Column({ name: 'dislikes_count', type: 'int', default: 0 })
  dislikesCount: number;

  @ApiProperty()
  @Column({ name: 'reputation_score', type: 'int', default: 0 })
  reputationScore: number;

  @ApiPropertyOptional()
  @Column({ name: 'reputation_updated_at', type: 'timestamptz', nullable: true })
  reputationUpdatedAt: Date | null;
}
