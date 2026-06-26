import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IStorageService, STORAGE_SERVICE } from '@core/storage/storage.types';
import { PostsService } from '@modules/posts/posts.service';
import { MediaType, PostMedia } from './entities/post-media.entity';

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME = ['video/mp4'];

@Injectable()
export class PostMediaService {
  constructor(
    @InjectRepository(PostMedia)
    private readonly mediaRepo: Repository<PostMedia>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: IStorageService,
    private readonly postsService: PostsService,
  ) {}

  async addToPost(
    postId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<PostMedia> {
    const post = await this.postsService.getVisibleEntityOrFail(postId);
    if (post.authorId !== userId) {
      throw new ForbiddenException('No puedes adjuntar media a esta publicación');
    }

    const type = this.resolveType(file.mimetype);

    const stored = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'posts',
    });

    const media = this.mediaRepo.create({
      postId,
      url: stored.url,
      storageKey: stored.storageKey,
      type,
    });
    return this.mediaRepo.save(media);
  }

  async remove(mediaId: string, userId: string): Promise<{ success: true }> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId }, relations: { post: true } });
    if (!media) {
      throw new NotFoundException('Media no encontrada');
    }
    if (media.post?.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta media');
    }
    await this.storage.delete(media.storageKey);
    await this.mediaRepo.remove(media);
    return { success: true };
  }

  private resolveType(mime: string): MediaType {
    if (IMAGE_MIME.includes(mime)) return 'IMAGE';
    if (VIDEO_MIME.includes(mime)) return 'VIDEO';
    throw new BadRequestException('Formato no permitido (jpeg, png, webp, mp4)');
  }
}
