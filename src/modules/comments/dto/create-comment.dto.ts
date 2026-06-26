import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: '¿Sigue disponible la promo?' })
  @IsString()
  @Length(1, 2000)
  content: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Para responder a otro comentario' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
