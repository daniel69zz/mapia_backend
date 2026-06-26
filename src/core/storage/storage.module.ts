import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '@core/config/configuration';
import { STORAGE_SERVICE } from './storage.types';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  providers: [
    LocalStorageService,
    SupabaseStorageService,
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService, LocalStorageService, SupabaseStorageService],
      useFactory: (
        configService: ConfigService,
        localStorage: LocalStorageService,
        supabaseStorage: SupabaseStorageService,
      ) => {
        const storage = configService.get<StorageConfig>('storage')!;
        return storage.driver === 'supabase' ? supabaseStorage : localStorage;
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
