import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AlertReport } from './alert-report.entity';

@Entity('report_images')
export class AlertReportImage {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index('idx_report_images_report')
  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => AlertReport, (report) => report.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report?: AlertReport;

  @ApiProperty()
  @Column({ type: 'text' })
  url: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  path: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
