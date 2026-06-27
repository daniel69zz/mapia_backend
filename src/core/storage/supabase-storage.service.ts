import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { StorageConfig } from '@core/config/configuration';
import { IStorageService, StorageUploadInput, StorageUploadResult } from './storage.types';

@Injectable()
export class SupabaseStorageService implements IStorageService {
  private readonly config: StorageConfig;
  private readonly client: SupabaseClient | null;

  constructor(configService: ConfigService) {
    this.config = configService.get<StorageConfig>('storage')!;
    this.client =
      this.config.supabaseUrl && this.config.supabaseServiceRoleKey
        ? createClient(this.config.supabaseUrl, this.config.supabaseServiceRoleKey)
        : null;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!this.client) {
      throw new BadRequestException('Supabase Storage no esta configurado');
    }

    const extension = extname(input.originalName).toLowerCase();
    const safeFolder = input.folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const storageKey = `${safeFolder}/${Date.now()}-${randomUUID()}${extension}`;
    const { error } = await this.client.storage
      .from(this.config.supabaseBucket)
      .upload(storageKey, input.buffer, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`No se pudo subir el archivo: ${error.message}`);
    }

    const { data } = this.client.storage.from(this.config.supabaseBucket).getPublicUrl(storageKey);

    return { storageKey, url: data.publicUrl };
  }

  async delete(storageKey: string): Promise<void> {
    if (!this.client) return;
    await this.client.storage.from(this.config.supabaseBucket).remove([storageKey]);
  }
}
