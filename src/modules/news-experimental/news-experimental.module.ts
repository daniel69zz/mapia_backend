import { Module } from '@nestjs/common';
import { NewsExperimentalController } from './news-experimental.controller';
import { NewsExperimentalService } from './news-experimental.service';

@Module({
  controllers: [NewsExperimentalController],
  providers: [NewsExperimentalService],
})
export class NewsExperimentalModule {}
