import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { StorageModule } from '@core/storage/storage.module';
import { Reaction } from '@modules/reactions/entities/reaction.entity';
import { PostMedia } from '@modules/post-media/entities/post-media.entity';
import { Post } from './entities/post.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Reaction, PostMedia]),
    ProfilesModule,
    StorageModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
