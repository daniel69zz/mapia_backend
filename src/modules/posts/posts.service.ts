import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { PaginatedResult } from '@common/dtos/pagination.dto';
import { PostStatus, PostVisibility } from '@common/enums/post.enums';
import { IStorageService, STORAGE_SERVICE } from '@core/storage/storage.types';
import { ProfilesService } from '@modules/profiles/profiles.service';
import { Reaction } from '@modules/reactions/entities/reaction.entity';
import { PostMedia } from '@modules/post-media/entities/post-media.entity';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { toPostResponse } from './mappers/post.mapper';

const POST_RELATIONS = { author: { profile: true }, media: true } as const;

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function isAllowedImageMime(mimetype: string, name: string): boolean {
  if (IMAGE_MIME.includes(mimetype)) return true;
  const lower = (name ?? '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => lower.endsWith(ext));
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(PostMedia)
    private readonly postMediaRepo: Repository<PostMedia>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: IStorageService,
    private readonly profilesService: ProfilesService,
  ) {}

  /** Devuelve el conjunto de postIds (de la lista dada) que el usuario ya likeó. */
  private async reactionMap(
    currentUserId: string | undefined,
    postIds: string[],
  ): Promise<Map<string, 'LIKE' | 'DISLIKE'>> {
    if (!currentUserId || postIds.length === 0) {
      return new Map<string, 'LIKE' | 'DISLIKE'>();
    }
    const reactions = await this.reactionRepo.find({
      where: { userId: currentUserId, postId: In(postIds) },
      select: { postId: true, type: true },
    });
    return new Map(reactions.map((r) => [r.postId, r.type]));
  }

  async create(
    authorId: string,
    dto: CreatePostDto,
    images: Express.Multer.File[] = [],
  ): Promise<PostResponseDto> {
    const post = this.postRepo.create({
      authorId,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: dto.address ?? null,
      locationName: dto.locationName ?? dto.address ?? null,
      radiusMeters: dto.radiusMeters ?? null,
      showOnMap: dto.showOnMap ?? true,
      // Decisión de proyecto: se publica directo; moderación es reactiva.
      status: PostStatus.PUBLISHED,
      visibility: PostVisibility.PUBLIC,
    });
    const saved = await this.postRepo.save(post);

    for (const image of images) {
      if (!isAllowedImageMime(image.mimetype, image.originalname)) continue;
      const stored = await this.storage.upload({
        buffer: image.buffer,
        originalName: image.originalname,
        mimeType: image.mimetype,
        folder: `posts/${saved.id}`,
      });
      await this.postMediaRepo.save(
        this.postMediaRepo.create({
          postId: saved.id,
          url: stored.url,
          storageKey: stored.storageKey,
          type: 'IMAGE',
        }),
      );
    }

    await this.profilesService.incrementPosts(authorId, 1);
    return this.findOne(saved.id, authorId);
  }

  async findAll(
    query: QueryPostsDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    // El feed muestra contenido de usuario (eventos + incidencias); las noticias
    // IA viven en la sección Explorar, no en el feed principal.
    const where: FindOptionsWhere<Post> = {
      visibility: PostVisibility.PUBLIC,
      contentType: Not('NEWS'),
    };
    if (query.type) {
      where.type = query.type;
    }
    const [items, total] = await this.postRepo.findAndCount({
      where,
      relations: POST_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    const reactions = await this.reactionMap(
      currentUserId,
      items.map((p) => p.id),
    );
    return new PaginatedResult(
      items.map((p) => toPostResponse(p, reactions.get(p.id) ?? null)),
      total,
      query.page,
      query.limit,
    );
  }

  async findByUser(
    userId: string,
    query: QueryPostsDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    const [items, total] = await this.postRepo.findAndCount({
      where: { authorId: userId, visibility: PostVisibility.PUBLIC },
      relations: POST_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    const reactions = await this.reactionMap(
      currentUserId,
      items.map((p) => p.id),
    );
    return new PaginatedResult(
      items.map((p) => toPostResponse(p, reactions.get(p.id) ?? null)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(id: string, currentUserId?: string): Promise<PostResponseDto> {
    const post = await this.postRepo.findOne({ where: { id }, relations: POST_RELATIONS });
    if (!post || post.visibility === PostVisibility.DELETED) {
      throw new NotFoundException('Publicación no encontrada');
    }
    const reactions = await this.reactionMap(currentUserId, [post.id]);
    return toPostResponse(post, reactions.get(post.id) ?? null);
  }

  async update(id: string, userId: string, dto: UpdatePostDto): Promise<PostResponseDto> {
    const post = await this.getOwnedEntity(id, userId);
    Object.assign(post, {
      title: dto.title ?? post.title,
      description: dto.description ?? post.description,
      type: dto.type ?? post.type,
      latitude: dto.latitude ?? post.latitude,
      longitude: dto.longitude ?? post.longitude,
      address: dto.address ?? post.address,
      locationName: dto.locationName ?? dto.address ?? post.locationName,
      radiusMeters: dto.radiusMeters ?? post.radiusMeters,
      showOnMap: dto.showOnMap ?? post.showOnMap,
    });
    await this.postRepo.save(post);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<{ success: true }> {
    const post = await this.getOwnedEntity(id, userId);
    post.visibility = PostVisibility.DELETED;
    post.status = PostStatus.DELETED;
    await this.postRepo.save(post);
    await this.profilesService.incrementPosts(userId, -1);
    return { success: true };
  }

  /** Ajuste de contador de comentarios (usado por CommentsService). */
  incrementComments(postId: string, delta: number): Promise<unknown> {
    return this.postRepo.increment({ id: postId }, 'commentsCount', delta);
  }

  /** Ajuste de contador de likes (usado por ReactionsService). */
  incrementLikes(postId: string, delta: number): Promise<unknown> {
    return this.postRepo.increment({ id: postId }, 'likesCount', delta);
  }

  /** Ajuste de contador de dislikes (usado por ReactionsService). */
  incrementDislikes(postId: string, delta: number): Promise<unknown> {
    return this.postRepo.increment({ id: postId }, 'dislikesCount', delta);
  }

  /** Ajuste de contador de reportes (usado por ReportsService en fase 2). */
  incrementReports(postId: string, delta: number): Promise<unknown> {
    return this.postRepo.increment({ id: postId }, 'reportsCount', delta);
  }

  /** Acceso interno para reactions/comments (verifica existencia y visibilidad). */
  async getVisibleEntityOrFail(id: string): Promise<Post> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post || post.visibility === PostVisibility.DELETED) {
      throw new NotFoundException('Publicación no encontrada');
    }
    return post;
  }

  private async getOwnedEntity(id: string, userId: string): Promise<Post> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post || post.visibility === PostVisibility.DELETED) {
      throw new NotFoundException('Publicación no encontrada');
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('No puedes modificar esta publicación');
    }
    return post;
  }
}
