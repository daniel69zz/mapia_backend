import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: '¿Sigue disponible la promo?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  content: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Para responder a otro comentario' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
