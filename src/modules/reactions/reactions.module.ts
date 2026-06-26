import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsModule } from '@modules/posts/posts.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { Reaction } from './entities/reaction.entity';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction]), PostsModule, ProfilesModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}
