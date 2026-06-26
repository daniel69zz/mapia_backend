import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { GeoQueryDto } from '@common/dtos/geo-query.dto';
import { AlertsService } from './alerts.service';
import { AlertSummaryDto, AlertsNearbyPostsQueryDto } from './dto/alerts-query.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Public()
  @Get('nearby-summary')
  @ApiOperation({ summary: 'Resumen de alertas por tipo cerca del usuario' })
  summary(@Query() query: GeoQueryDto): Promise<AlertSummaryDto[]> {
    return this.alertsService.nearbySummary(query);
  }

  @Public()
  @Get('nearby-posts')
  @ApiOperation({ summary: 'Publicaciones cercanas de un tipo concreto' })
  nearbyPosts(@Query() query: AlertsNearbyPostsQueryDto) {
    return this.alertsService.nearbyByType(query);
  }
}
