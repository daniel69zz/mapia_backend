import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { NewsExperimentalService } from './news-experimental.service';
import { ExperimentalNewsItem } from './news-experimental.types';

@ApiTags('experimental-news')
@Controller('experimental/news')
export class NewsExperimentalController {
  constructor(private readonly newsService: NewsExperimentalService) {}

  @Public()
  @Get('el-deber')
  @ApiOperation({ summary: 'Experimental: noticias RSS de El Deber' })
  getElDeberNews(): Promise<ExperimentalNewsItem[]> {
    return this.newsService.getElDeberNews();
  }
}
