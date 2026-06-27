import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';

export class AskDto {
  @ApiProperty({ example: '¿Hay bloqueos cerca?' })
  @IsString()
  @Length(1, 1000)
  message: string;

  @ApiPropertyOptional({ example: -16.5, description: 'Latitud del usuario (para "cerca")' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -68.15, description: 'Longitud del usuario (para "cerca")' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}
