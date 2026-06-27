import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';

export class AnalyzeReportDto {
  @ApiProperty({ example: 'Hay un bloqueo en la av. 6 de marzo, pasan solo peatones' })
  @IsString()
  @Length(3, 5000)
  text: string;

  @ApiPropertyOptional({ example: -16.5 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -68.15 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
