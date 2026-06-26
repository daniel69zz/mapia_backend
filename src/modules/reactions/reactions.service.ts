import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { PostsService } from '@modules/posts/posts.service';
import { ProfilesService } from '@modules/profiles/profiles.service';
import { Reaction } from './entities/reaction.entity';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    private readonly postsService: PostsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async like(postId: string, userId: string): Promise<{ liked: true; likesCount: number }> {
    const post = await this.postsService.getVisibleEntityOrFail(postId);

    const existing = await this.reactionRepo.findOne({ where: { postId, userId } });
    if (existing) {
      throw new ConflictException('Ya diste like a esta publicación');
    }

    await this.reactionRepo.save(this.reactionRepo.create({ postId, userId, type: 'LIKE' }));
    await this.postsService.incrementLikes(postId, 1);
    // Like recibido suma al perfil del autor.
    await this.profilesService.incrementLikes(post.authorId, 1);

    return { liked: true, likesCount: post.likesCount + 1 };
  }

  async unlike(postId: string, userId: string): Promise<{ liked: false }> {
    const post = await this.postsService.getVisibleEntityOrFail(postId);
    const existing = await this.reactionRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.reactionRepo.remove(existing);
      await this.postsService.incrementLikes(postId, -1);
      await this.profilesService.incrementLikes(post.authorId, -1);
    }
    return { liked: false };
  }

  async listByPost(
    postId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Reaction>> {
    await this.postsService.getVisibleEntityOrFail(postId);
    const [items, total] = await this.reactionRepo.findAndCount({
      where: { postId },
      relations: { user: { profile: true } },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return new PaginatedResult(items, total, query.page, query.limit);
  }
}
