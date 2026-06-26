import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';
import { REPORT_CATEGORIES, ReportCategory } from '@core/ai/ai.types';

export class NearbyReportsDto {
  @ApiProperty({ example: -16.5 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: -68.15 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 1500, description: 'Radio en metros (default 1500, máx 50000)' })
  @IsOptional()
  @Type(() => Number)
  @Min(50)
  @Max(50000)
  radius?: number;

  @ApiPropertyOptional({ enum: REPORT_CATEGORIES })
  @IsOptional()
  @IsIn(REPORT_CATEGORIES)
  category?: ReportCategory;
}
