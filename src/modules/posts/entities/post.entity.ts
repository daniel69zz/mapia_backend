import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PostStatus, PostType, PostVisibility } from '@common/enums/post.enums';
import { User } from '@modules/users/entities/user.entity';
import { PostMedia } from '@modules/post-media/entities/post-media.entity';

/** Naturaleza del contenido unificado (tabla única `posts`). */
export type ContentType = 'EVENT' | 'INCIDENT' | 'NEWS' | 'OTHER';
/** Quién generó el contenido. */
export type AuthorType = 'USER' | 'AI';
/** Severidad (para incidencias/alertas). */
export type ContentSeverity = 'normal' | 'low' | 'medium' | 'high';

/**
 * Publicación geolocalizada (núcleo de Mapia).
 *
 * IMPORTANTE: la columna geográfica `location geography(Point,4326)` NO se declara
 * aquí. La crea la migración junto con su índice GIST y un trigger BEFORE INSERT/UPDATE
 * que la deriva de latitude/longitude. Las consultas de cercanía usan ST_DWithin vía
 * QueryBuilder (ver PostsService / map / alerts).
 */
@Entity('posts')
@Index('idx_posts_type', ['type'])
@Index('idx_posts_status', ['status'])
@Index('idx_posts_visibility', ['visibility'])
export class Post extends BaseEntity {
  @ApiPropertyOptional({ format: 'uuid' })
  @Index('idx_posts_author')
  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @ApiProperty()
  @Column({ type: 'varchar', length: 160 })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ enum: PostType })
  @Column({ type: 'enum', enum: PostType })
  type: PostType;

  @ApiProperty({ description: 'Naturaleza del contenido', example: 'EVENT' })
  @Index('idx_posts_content_type')
  @Column({ name: 'content_type', type: 'text', default: 'EVENT' })
  contentType: ContentType;

  @ApiProperty({ description: 'Autor: USER o AI', example: 'USER' })
  @Index('idx_posts_author_type')
  @Column({ name: 'author_type', type: 'text', default: 'USER' })
  authorType: AuthorType;

  @ApiPropertyOptional({ description: 'Severidad (incidencias)', example: 'high' })
  @Column({ type: 'text', nullable: true })
  severity: ContentSeverity | null;

  @ApiPropertyOptional({ description: 'Fuente externa (noticias)', example: 'El Deber' })
  @Column({ name: 'source_name', type: 'varchar', length: 120, nullable: true })
  sourceName: string | null;

  @ApiPropertyOptional({ description: 'URL de la fuente (noticias)' })
  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @ApiPropertyOptional({ description: 'Datos específicos por categoría (jsonb)' })
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @ApiProperty({ enum: PostStatus })
  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.PUBLISHED })
  status: PostStatus;

  @ApiPropertyOptional({ example: -16.5 })
  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @ApiPropertyOptional({ example: -68.15 })
  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @ApiPropertyOptional({ example: 'Sopocachi, La Paz' })
  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: 'Plaza Abaroa' })
  @Column({ name: 'location_name', type: 'varchar', length: 300, nullable: true })
  locationName: string | null;

  @ApiPropertyOptional({ example: 500, description: 'Radio del evento en metros (0 = puntual)' })
  @Column({ name: 'radius_meters', type: 'integer', nullable: true })
  radiusMeters: number | null;

  @ApiProperty({ default: true })
  @Column({ name: 'show_on_map', type: 'boolean', default: true })
  showOnMap: boolean;

  @ApiProperty({ default: false })
  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @ApiProperty({ enum: PostVisibility })
  @Column({ type: 'enum', enum: PostVisibility, default: PostVisibility.PUBLIC })
  visibility: PostVisibility;

  @ApiProperty()
  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount: number;

  @ApiProperty()
  @Column({ name: 'dislikes_count', type: 'int', default: 0 })
  dislikesCount: number;

  @ApiProperty()
  @Column({ name: 'comments_count', type: 'int', default: 0 })
  commentsCount: number;

  @ApiProperty()
  @Column({ name: 'reports_count', type: 'int', default: 0 })
  reportsCount: number;

  @OneToMany(() => PostMedia, (media) => media.post)
  media?: PostMedia[];
}
