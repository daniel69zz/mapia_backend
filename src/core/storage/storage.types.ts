export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StorageUploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}

export interface StorageUploadResult {
  url: string;
  storageKey: string;
}

export interface IStorageService {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(storageKey: string): Promise<void>;
}
