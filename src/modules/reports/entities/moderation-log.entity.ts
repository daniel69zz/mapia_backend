import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

export type ModerationAction =
  | 'auto_publish'
  | 'sent_to_review'
  | 'approved'
  | 'rejected'
  | 'edited';

/** Bitácora de transiciones de estado de un reporte (sistema o moderador). */
@Entity('moderation_logs')
export class ModerationLog extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index('idx_moderation_report')
  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'null = acción automática del sistema' })
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ApiProperty({ example: 'auto_publish' })
  @Column({ type: 'text' })
  action: ModerationAction;

  @ApiPropertyOptional()
  @Column({ name: 'from_status', type: 'text', nullable: true })
  fromStatus: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'to_status', type: 'text', nullable: true })
  toStatus: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  metadata: unknown;
}
