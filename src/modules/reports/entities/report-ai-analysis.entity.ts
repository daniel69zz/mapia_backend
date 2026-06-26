import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ReportCategory } from '@core/ai/ai.types';
import { AlertReport } from './alert-report.entity';

/** Una fila por llamada al modelo de IA sobre una imagen de reporte (auditoría). */
@Entity('report_ai_analysis')
export class ReportAiAnalysis extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index('idx_ai_analysis_report')
  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => AlertReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report?: AlertReport;

  @ApiPropertyOptional({ format: 'uuid' })
  @Column({ name: 'image_id', type: 'uuid', nullable: true })
  imageId: string | null;

  @ApiProperty({ example: 'vertex' })
  @Column({ type: 'text' })
  provider: string;

  @ApiProperty({ example: 'gemini-2.0-flash' })
  @Column({ type: 'text' })
  model: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  category: ReportCategory | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  title: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', nullable: true })
  confidence: string | null;

  @ApiProperty({ type: [String] })
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @ApiProperty()
  @Column({ name: 'requires_review', type: 'boolean', default: false })
  requiresReview: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'detected_text', type: 'text', nullable: true })
  detectedText: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'safety_notes', type: 'text', nullable: true })
  safetyNotes: string | null;

  @ApiProperty()
  @Column({ name: 'raw_response', type: 'jsonb' })
  rawResponse: unknown;

  @ApiPropertyOptional()
  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs: number | null;
}
