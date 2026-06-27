import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { NewsService } from './news.service';
import { MapNewsItem } from './news.types';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get('today/map')
  @ApiOperation({ summary: 'Noticias del día geolocalizadas para el mapa' })
  getTodayMapNews(): Promise<MapNewsItem[]> {
    return this.newsService.getTodayMapNews();
  }
}
