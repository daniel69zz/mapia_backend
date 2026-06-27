import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
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

  @Public()
  @Get('generated-posts')
  @ApiOperation({ summary: 'Publicaciones de noticias persistidas (Explorar)' })
  getGeneratedPosts() {
    return this.newsService.getGeneratedPosts();
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Estado de la ingestión de noticias' })
  getStatus() {
    return this.newsService.getStatus();
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingesta el RSS de El Deber y persiste noticias nuevas' })
  refresh() {
    return this.newsService.refresh();
  }
}
