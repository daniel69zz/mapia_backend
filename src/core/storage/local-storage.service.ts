import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { StorageConfig } from '@core/config/configuration';
import { IStorageService, StorageUploadInput, StorageUploadResult } from './storage.types';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly config: StorageConfig;

  constructor(configService: ConfigService) {
    this.config = configService.get<StorageConfig>('storage')!;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const extension = extname(input.originalName).toLowerCase();
    const safeFolder = input.folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const storageKey = `${safeFolder}/${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(process.cwd(), this.config.localDir, storageKey);

    await mkdir(join(process.cwd(), this.config.localDir, safeFolder), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey,
      url: `${this.config.publicUrl.replace(/\/$/, '')}/${storageKey.replace(/\\/g, '/')}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    await rm(join(process.cwd(), this.config.localDir, storageKey), { force: true });
  }
}
