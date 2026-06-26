import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ReportReason } from '@common/enums/report-reason.enum';

export class CreateReportDto {
  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ example: 'Información falsa, no hay tal bloqueo' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
