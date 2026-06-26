import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PostType } from '@common/enums/post.enums';

export class CreatePostDto {
  @ApiProperty({ example: 'Pollo barato cerca de la plaza' })
  @IsString()
  @Length(3, 160)
  title: string;

  @ApiProperty({ example: 'Promo de almuerzo a 12 Bs hasta las 14:00' })
  @IsString()
  @Length(1, 5000)
  description: string;

  @ApiProperty({ enum: PostType, example: PostType.FOOD_DEAL })
  @IsEnum(PostType)
  type: PostType;

  @ApiProperty({ example: -16.5 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -68.15 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 'Sopocachi, La Paz' })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  address?: string;
}
