import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '@core/storage/storage.module';
import { PostsModule } from '@modules/posts/posts.module';
import { PostMedia } from './entities/post-media.entity';
import { PostMediaController } from './post-media.controller';
import { PostMediaService } from './post-media.service';

@Module({
  imports: [TypeOrmModule.forFeature([PostMedia]), PostsModule, StorageModule],
  controllers: [PostMediaController],
  providers: [PostMediaService],
})
export class PostMediaModule {}
