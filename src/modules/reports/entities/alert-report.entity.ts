import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ReportCategory } from '@core/ai/ai.types';
import { AlertReportImage } from './alert-report-image.entity';

export type ReportSeverity = 'normal' | 'low' | 'medium' | 'high';
export type AlertType =
  | 'stock_bajo'
  | 'sobreprecio'
  | 'bloqueo'
  | 'retraso_proveedor'
  | 'combustible'
  | 'producto_no_disponible'
  | 'otro';

/** Estados del reporte (flujo IA + moderación). */
export type ReportStatus =
  | 'draft'
  | 'pending_analysis'
  | 'analyzed'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'active'; // legado del flujo de alertas de abastecimiento

@Entity('reports')
@Index('idx_reports_location', ['latitude', 'longitude'])
@Index('idx_reports_department', ['department'])
@Index('idx_reports_product', ['product'])
@Index('idx_reports_alert_type', ['alertType'])
@Index('idx_reports_severity', ['severity'])
@Index('idx_reports_category', ['category'])
@Index('idx_reports_user', ['userId'])
@Index('idx_reports_created_at', ['createdAt'])
export class AlertReport extends BaseEntity {
  @ApiPropertyOptional({ format: 'uuid', description: 'Autor del reporte (null = anónimo)' })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ApiProperty()
  @Column({ type: 'text' })
  title: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ description: 'Categoría del reporte ciudadano por imagen (IA)' })
  @Column({ type: 'text', nullable: true })
  category: ReportCategory | null;

  @ApiProperty({ type: [String] })
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  product: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'alert_type', type: 'text', nullable: true })
  alertType: AlertType | null;

  @ApiPropertyOptional({ enum: ['normal', 'low', 'medium', 'high'] })
  @Column({ type: 'text', nullable: true })
  severity: ReportSeverity | null;

  @ApiProperty({ example: -16.495 })
  @Column({ type: 'double precision' })
  latitude: number;

  @ApiProperty({ example: -68.133 })
  @Column({ type: 'double precision' })
  longitude: number;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  department: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  municipality: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  zone: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', nullable: true })
  price: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'source_text', type: 'text', nullable: true })
  sourceText: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'numeric', nullable: true })
  confidence: string | null;

  @ApiProperty()
  @Column({ type: 'text', default: 'active' })
  status: ReportStatus;

  @OneToMany(() => AlertReportImage, (image) => image.report)
  images?: AlertReportImage[];
}
