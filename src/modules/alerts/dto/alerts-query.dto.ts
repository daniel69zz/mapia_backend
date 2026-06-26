import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GeoQueryDto } from '@common/dtos/geo-query.dto';
import { PostType } from '@common/enums/post.enums';

export class AlertsNearbyPostsQueryDto extends GeoQueryDto {
  @ApiProperty({ enum: PostType })
  @IsEnum(PostType)
  type: PostType;
}

export class AlertSummaryDto {
  @ApiProperty({ enum: PostType }) type: PostType;
  @ApiProperty() count: number;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() radiusKm: number;
}
