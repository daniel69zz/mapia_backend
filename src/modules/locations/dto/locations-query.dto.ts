import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsString, Length } from 'class-validator';

export class ReverseGeocodeQueryDto {
  @ApiProperty({ example: -16.5 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: -68.15 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class PlacesSearchQueryDto {
  @ApiProperty({ example: 'Sopocachi' })
  @IsString()
  @Length(2, 120)
  q: string;
}

export class GeoPlaceDto {
  @ApiProperty() formattedAddress: string;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiProperty({ description: 'Origen del dato: google' }) source: 'google';
}
