import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';

export class ParseCitizenReportDto {
  @ApiProperty({ example: 'En el mercado Rodriguez el azucar subio a 9 Bs y casi no hay stock.' })
  @IsString()
  @Length(5, 5000)
  text: string;

  @ApiPropertyOptional({ example: -16.495 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -68.133 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
