import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsModule } from '@modules/posts/posts.module';
import { ReportCandidate } from './entities/report-candidate.entity';
import { ReportCandidatesController } from './report-candidates.controller';
import { ReportCandidatesService } from './report-candidates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportCandidate]), PostsModule],
  controllers: [ReportCandidatesController],
  providers: [ReportCandidatesService],
})
export class ReportCandidatesModule {}
