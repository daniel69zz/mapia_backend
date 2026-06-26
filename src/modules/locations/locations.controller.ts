import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { LocationsService } from './locations.service';
import {
  GeoPlaceDto,
  PlacesSearchQueryDto,
  ReverseGeocodeQueryDto,
} from './dto/locations-query.dto';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public()
  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocoding (coordenadas -> dirección)' })
  reverse(@Query() query: ReverseGeocodeQueryDto): Promise<GeoPlaceDto> {
    return this.locationsService.reverseGeocode(query.lat, query.lng);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Búsqueda de lugares por texto' })
  search(@Query() query: PlacesSearchQueryDto): Promise<GeoPlaceDto[]> {
    return this.locationsService.searchPlaces(query.q);
  }
}
