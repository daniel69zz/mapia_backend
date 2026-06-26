import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Query geográfica reutilizable por map y alerts.
 * radiusKm se valida aquí; el tope MAX_RADIUS_KM se aplica además en el servicio.
 */
export class GeoQueryDto {
  @ApiProperty({ example: -16.5, description: 'Latitud (-90 a 90)' })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: -68.15, description: 'Longitud (-180 a 180)' })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 3, default: 3, description: 'Radio en km (1 a 50)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radiusKm?: number;
}
