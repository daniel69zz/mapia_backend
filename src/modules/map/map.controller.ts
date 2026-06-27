import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { MapService } from './map.service';
import { RoutingService } from './routing.service';
import { PlacesService } from './places.service';
import { RouteQueryDto } from './dto/route-query.dto';
import { MapAlertsQueryDto } from './dto/map-alerts-query.dto';
import { MapBboxQueryDto, MapMarkerDto, MapNearbyQueryDto } from './dto/map-query.dto';
import { MapPublicationsQueryDto } from './dto/map-publications-query.dto';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(
    private readonly mapService: MapService,
    private readonly routingService: RoutingService,
    private readonly placesService: PlacesService,
  ) {}

  @Public()
  @Get('places/autocomplete')
  @ApiOperation({ summary: 'Autocompletar lugares (Google Places)' })
  async placesAutocomplete(
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const items = await this.placesService.autocomplete(
      q ?? '',
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
    return { items };
  }

  @Public()
  @Get('places/details')
  @ApiOperation({ summary: 'Detalle de un lugar por placeId' })
  placeDetails(@Query('placeId') placeId: string) {
    return this.placesService.details(placeId);
  }

  @Public()
  @Get('geocode/reverse')
  @ApiOperation({ summary: 'Dirección a partir de coordenadas (reverse geocode)' })
  reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.placesService.reverseGeocode(Number(lat), Number(lng));
  }

  @Public()
  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ruta óptima evitando bloqueos/obstrucciones activas' })
  route(@Body() dto: RouteQueryDto) {
    return this.routingService.route(dto);
  }

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Marcadores dentro de un bounding box (viewport)' })
  byBbox(@Query() query: MapBboxQueryDto): Promise<MapMarkerDto[]> {
    return this.mapService.byBbox(query);
  }

  @Public()
  @Get('posts/nearby')
  @ApiOperation({ summary: 'Marcadores cercanos a un punto por radio (PostGIS)' })
  nearby(@Query() query: MapNearbyQueryDto): Promise<MapMarkerDto[]> {
    return this.mapService.nearby(query);
  }

  @Public()
  @Get('publications')
  @ApiOperation({ summary: 'Publicaciones (marcadores) del mapa por viewport' })
  publications(@Query() query: MapPublicationsQueryDto) {
    return this.mapService.publications(query);
  }

  @Public()
  @Get('alerts')
  @ApiOperation({ summary: 'Alertas ciudadanas para el mapa de Bolivia' })
  alerts(@Query() query: MapAlertsQueryDto) {
    return this.mapService.alerts(query);
  }

  @Public()
  @Get('summary')
  @ApiOperation({ summary: 'Resumen de alertas ciudadanas' })
  summary(@Query() query: MapAlertsQueryDto) {
    return this.mapService.summary(query);
  }

  @Public()
  @Get('filters')
  @ApiOperation({ summary: 'Valores disponibles para filtros de alertas' })
  filters() {
    return this.mapService.filters();
  }
}
