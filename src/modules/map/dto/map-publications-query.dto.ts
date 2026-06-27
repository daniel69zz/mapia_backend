import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';

/** Bounding box del viewport (todas opcionales; si faltan, devuelve recientes). */
export class MapPublicationsQueryDto {
  @ApiPropertyOptional({ example: -16.4 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  north?: number;

  @ApiPropertyOptional({ example: -16.6 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  south?: number;

  @ApiPropertyOptional({ example: -68.0 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  east?: number;

  @ApiPropertyOptional({ example: -68.3 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  west?: number;
}
