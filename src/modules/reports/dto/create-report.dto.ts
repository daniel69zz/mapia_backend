import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export type CreateReportReason =
  | 'FALSE_INFORMATION'
  | 'INAPPROPRIATE'
  | 'SPAM'
  | 'OTHER'
  | 'FALSE_INFO'
  | 'OFFENSIVE'
  | 'DANGEROUS';

export class CreateReportDto {
  @ApiProperty({
    enum: ['FALSE_INFORMATION', 'SPAM', 'INAPPROPRIATE', 'OTHER'],
  })
  @IsIn(['FALSE_INFORMATION', 'INAPPROPRIATE', 'SPAM', 'OTHER', 'FALSE_INFO', 'OFFENSIVE', 'DANGEROUS'])
  reason: CreateReportReason;

  @ApiPropertyOptional({ example: 'Información falsa, no hay tal bloqueo' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
