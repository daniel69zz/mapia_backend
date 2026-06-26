import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class AnalyzePhotoDto {
  @ApiProperty({ example: -16.5, description: 'Latitud del dispositivo (no del modelo)' })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -68.15, description: 'Longitud del dispositivo (no del modelo)' })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}
