import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsModule } from '@modules/posts/posts.module';
import { StorageModule } from '@core/storage/storage.module';
import { AiModule } from '@core/ai/ai.module';
import { ContentReport } from './entities/content-report.entity';
import { AlertReport } from './entities/alert-report.entity';
import { AlertReportImage } from './entities/alert-report-image.entity';
import { ReportAiAnalysis } from './entities/report-ai-analysis.entity';
import { ModerationLog } from './entities/moderation-log.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AiVisionService } from './ai-vision.service';
import { ModerationService } from './moderation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentReport,
      AlertReport,
      AlertReportImage,
      ReportAiAnalysis,
      ModerationLog,
    ]),
    PostsModule,
    StorageModule,
    AiModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, AiVisionService, ModerationService],
})
export class ReportsModule {}
