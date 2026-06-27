import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class GenerateReportDto {
  @ApiPropertyOptional({ example: 'La Paz', default: 'Información no disponible' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  municipality?: string;
}
