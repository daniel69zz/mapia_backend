import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
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

  @ApiPropertyOptional({ example: 'Plaza Abaroa' })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  locationName?: string;

  @ApiPropertyOptional({ example: 500, description: 'Radio del evento en metros (0 = puntual)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  radiusMeters?: number;

  @ApiPropertyOptional({ example: true, description: 'Mostrar esta publicacion en el mapa' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  showOnMap?: boolean;

  @ApiPropertyOptional({ description: 'Datos adicionales' })
  @IsOptional()
  details?: Record<string, any>;
}
