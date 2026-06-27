import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { GeneratedNewsPost } from './entities/generated-news-post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GeneratedNewsPost])],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
