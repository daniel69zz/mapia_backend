import { Module } from '@nestjs/common';
import { PostsModule } from '@modules/posts/posts.module';
import { CommentsModule } from '@modules/comments/comments.module';
import { ReactionsModule } from '@modules/reactions/reactions.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { PublicationsController } from './publications.controller';

@Module({
  imports: [PostsModule, CommentsModule, ReactionsModule, ReportsModule],
  controllers: [PublicationsController],
})
export class PublicationsModule {}
