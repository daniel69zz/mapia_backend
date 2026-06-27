import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { MapService } from './map.service';
import { MapAlertsQueryDto } from './dto/map-alerts-query.dto';
import { MapBboxQueryDto, MapMarkerDto, MapNearbyQueryDto } from './dto/map-query.dto';
import { MapPublicationsQueryDto } from './dto/map-publications-query.dto';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

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
