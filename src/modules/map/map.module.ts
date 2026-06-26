import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '@modules/posts/entities/post.entity';
import { AlertReport } from '@modules/reports/entities/alert-report.entity';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, AlertReport])],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
