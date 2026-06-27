import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ReportCandidateStatus } from '../entities/report-candidate.entity';

const STATUSES: ReportCandidateStatus[] = [
  'pendiente_revision',
  'aprobado_para_informe',
  'rechazado',
  'incluido_en_informe',
  'enviado',
  'resuelto',
];

export class UpdateCandidateStatusDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status: ReportCandidateStatus;

  @ApiPropertyOptional({ description: 'Motivo cuando el estado es "rechazado"' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  rejectionReason?: string;
}
