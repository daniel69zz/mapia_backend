import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '@core/storage/storage.module';
import { Profile } from './entities/profile.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { OtpService } from './otp.service';

@Module({
  imports: [TypeOrmModule.forFeature([Profile]), StorageModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, OtpService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
