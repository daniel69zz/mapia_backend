import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class ChatTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  text: string;
}

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

  @ApiPropertyOptional({
    type: [ChatTurnDto],
    description: 'Memoria corta: últimos turnos de la conversación',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
