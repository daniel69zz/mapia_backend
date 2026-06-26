import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '@modules/profiles/entities/profile.entity';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { UsersModule } from '@modules/users/users.module';
import { Follow } from './entities/follow.entity';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, Profile]), ProfilesModule, UsersModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
