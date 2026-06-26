import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GeoQueryDto } from '@common/dtos/geo-query.dto';
import { PostType } from '@common/enums/post.enums';

export class MapNearbyQueryDto extends GeoQueryDto {
  @ApiPropertyOptional({ enum: PostType, description: 'Filtrar marcadores por tipo' })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}

export class MapBboxQueryDto {
  @ApiProperty({
    example: '-68.20,-16.55,-68.10,-16.45',
    description: 'Bounding box: minLng,minLat,maxLng,maxLat',
  })
  @IsString()
  bbox: string;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}

export class MapMarkerAuthorDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
}

export class MapMarkerDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: PostType }) type: PostType;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ description: 'Para derivar status/insignia "verificado" en el mapa' })
  isVerified: boolean;
  @ApiProperty({ type: MapMarkerAuthorDto }) author: MapMarkerAuthorDto;
}
