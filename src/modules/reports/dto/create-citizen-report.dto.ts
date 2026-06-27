import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { AlertType, ReportSeverity } from '../entities/alert-report.entity';

export const ALERT_TYPES: AlertType[] = [
  'stock_bajo',
  'sobreprecio',
  'bloqueo',
  'retraso_proveedor',
  'combustible',
  'producto_no_disponible',
  'otro',
];

export const REPORT_SEVERITIES: ReportSeverity[] = ['normal', 'low', 'medium', 'high'];

export class CreateCitizenReportDto {
  @ApiProperty()
  @IsString()
  @Length(3, 180)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  product?: string;

  @ApiProperty({ enum: ALERT_TYPES })
  @IsIn(ALERT_TYPES)
  alertType: AlertType;

  @ApiProperty({ enum: REPORT_SEVERITIES })
  @IsIn(REPORT_SEVERITIES)
  severity: ReportSeverity;

  @ApiProperty({ example: -16.495 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -68.133 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  sourceText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({ description: 'Categoría del aviso (taxonomía nueva)' })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  category?: string;

  @ApiPropertyOptional({
    description: 'JSON con presentación + campos dinámicos por categoría',
  })
  @IsOptional()
  @IsString()
  @Length(0, 8000)
  details?: string;
}
