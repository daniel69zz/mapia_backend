import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { REPORT_CATEGORIES, ReportCategory } from '@core/ai/ai.types';

/** El usuario confirma/edita la sugerencia de la IA antes de publicar. */
export class ConfirmReportDto {
  @ApiPropertyOptional({ enum: REPORT_CATEGORIES })
  @IsOptional()
  @IsIn(REPORT_CATEGORIES)
  category?: ReportCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class RejectReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
