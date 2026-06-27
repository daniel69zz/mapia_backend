import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

/**
 * Noticia/publicación generada automáticamente desde una fuente externa (RSS).
 * Persistida para la sección Explorar (no se regenera en cada request).
 */
@Entity('generated_news')
@Index('idx_generated_news_created_at', ['createdAt'])
@Index('uq_generated_news_url', ['originalUrl'], { unique: true })
export class GeneratedNewsPost extends BaseEntity {
  @ApiProperty()
  @Column({ type: 'text' })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ example: 'El Deber' })
  @Column({ type: 'text' })
  source: string;

  @ApiProperty()
  @Column({ name: 'original_url', type: 'text' })
  originalUrl: string;

  @ApiProperty({ example: 'noticia' })
  @Column({ type: 'text', default: 'noticia' })
  category: string;

  @ApiProperty({ example: 'published' })
  @Column({ type: 'text', default: 'published' })
  status: string;

  @ApiProperty({ example: 'rss_polling' })
  @Column({ name: 'generated_by', type: 'text', default: 'rss_polling' })
  generatedBy: string;

  @ApiProperty({ default: true })
  @Column({ name: 'is_ai_generated', type: 'boolean', default: true })
  isAiGenerated: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @Column({ name: 'map_item_id', type: 'uuid', nullable: true })
  mapItemId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'location_text', type: 'text', nullable: true })
  locationText: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @ApiPropertyOptional()
  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
