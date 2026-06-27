import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '@modules/posts/entities/post.entity';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
