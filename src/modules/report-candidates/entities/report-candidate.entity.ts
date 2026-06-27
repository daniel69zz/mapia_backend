import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

/** Categorías del candidato a informe (coinciden con el enum del frontend). */
export type ReportCandidateCategory =
  | 'bloqueo'
  | 'corte_servicio'
  | 'basura'
  | 'bache'
  | 'alumbrado'
  | 'transporte'
  | 'seguridad'
  | 'evento'
  | 'venta_irregular'
  | 'otro_problema_urbano';

/** Estados del flujo de revisión → informe. */
export type ReportCandidateStatus =
  | 'pendiente_revision'
  | 'aprobado_para_informe'
  | 'rechazado'
  | 'incluido_en_informe'
  | 'enviado'
  | 'resuelto';

export type ReportCandidatePriority = 'baja' | 'media' | 'alta' | 'urgente';

/**
 * Candidato a "informe ciudadano": derivado de una publicación, pasa por una
 * revisión (pendiente → aprobado/rechazado) y luego se agrupa en un informe.
 */
@Entity('report_candidates')
@Index('idx_report_candidates_status', ['status'])
@Index('idx_report_candidates_post', ['postId'])
@Index('idx_report_candidates_created_at', ['createdAt'])
export class ReportCandidate extends BaseEntity {
  @ApiPropertyOptional({ format: 'uuid', description: 'Publicación de origen' })
  @Column({ name: 'post_id', type: 'uuid', nullable: true })
  postId: string | null;

  @ApiProperty()
  @Column({ type: 'text' })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  summary: string;

  @ApiProperty()
  @Column({ type: 'text', default: 'otro_problema_urbano' })
  category: ReportCandidateCategory;

  @ApiProperty()
  @Column({ type: 'text', default: 'pendiente_revision' })
  status: ReportCandidateStatus;

  @ApiProperty()
  @Column({ type: 'text', default: 'media' })
  priority: ReportCandidatePriority;

  @ApiPropertyOptional()
  @Column({ name: 'location_text', type: 'text', nullable: true })
  locationText: string | null;

  @ApiPropertyOptional({ example: -16.5 })
  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: -68.15 })
  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @ApiProperty({ type: [String] })
  @Column({ name: 'evidence_urls', type: 'text', array: true, default: () => "'{}'" })
  evidenceUrls: string[];

  @ApiProperty()
  @Column({ name: 'citizen_support_count', type: 'int', default: 0 })
  citizenSupportCount: number;

  @ApiProperty()
  @Column({ name: 'comments_count', type: 'int', default: 0 })
  commentsCount: number;

  @ApiPropertyOptional()
  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'suggested_solution', type: 'text', nullable: true })
  suggestedSolution: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;
}
