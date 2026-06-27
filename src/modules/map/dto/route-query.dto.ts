import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class RouteQueryDto {
  @ApiProperty({ example: -16.5 })
  @Type(() => Number)
  @IsLatitude()
  originLat: number;

  @ApiProperty({ example: -68.12 })
  @Type(() => Number)
  @IsLongitude()
  originLng: number;

  @ApiProperty({ example: -16.52 })
  @Type(() => Number)
  @IsLatitude()
  destLat: number;

  @ApiProperty({ example: -68.15 })
  @Type(() => Number)
  @IsLongitude()
  destLng: number;
}
