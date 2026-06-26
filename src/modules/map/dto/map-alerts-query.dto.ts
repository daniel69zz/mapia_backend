import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ALERT_TYPES, REPORT_SEVERITIES } from '@modules/reports/dto/create-citizen-report.dto';
import { AlertType, ReportSeverity } from '@modules/reports/entities/alert-report.entity';

export class MapAlertsQueryDto {
  @ApiPropertyOptional({ example: -16.5, description: 'Latitud del usuario' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -68.15, description: 'Longitud del usuario' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ example: 3, default: 3, description: 'Radio en km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 160)
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  product?: string;

  @ApiPropertyOptional({ enum: ALERT_TYPES })
  @IsOptional()
  @IsIn(ALERT_TYPES)
  alertType?: AlertType;

  @ApiPropertyOptional({ enum: REPORT_SEVERITIES })
  @IsOptional()
  @IsIn(REPORT_SEVERITIES)
  severity?: ReportSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}
