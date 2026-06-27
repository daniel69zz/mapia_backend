import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { PostsService } from '@modules/posts/posts.service';
import { Reaction, ReactionType } from './entities/reaction.entity';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    private readonly postsService: PostsService,
  ) {}

  async setReaction(
    postId: string,
    userId: string,
    type: ReactionType,
  ): Promise<{
    userReaction: ReactionType;
    likesCount: number;
    dislikesCount: number;
  }> {
    const post = await this.postsService.getVisibleEntityOrFail(postId);
    const existing = await this.reactionRepo.findOne({ where: { postId, userId } });

    if (existing) {
      const previousType = existing.type;
      if (previousType === type) {
        return {
          userReaction: type,
          likesCount: post.likesCount,
          dislikesCount: post.dislikesCount,
        };
      }

      await this.adjustCounters(postId, previousType, -1);
      existing.type = type;
      await this.reactionRepo.save(existing);
      await this.adjustCounters(postId, type, 1);

      return {
        userReaction: type,
        likesCount: post.likesCount + this.likeDelta(previousType, type),
        dislikesCount: post.dislikesCount + this.dislikeDelta(previousType, type),
      };
    }

    await this.reactionRepo.save(this.reactionRepo.create({ postId, userId, type }));
    await this.adjustCounters(postId, type, 1);

    return {
      userReaction: type,
      likesCount: post.likesCount + (type === 'LIKE' ? 1 : 0),
      dislikesCount: post.dislikesCount + (type === 'DISLIKE' ? 1 : 0),
    };
  }

  async like(postId: string, userId: string): Promise<{ liked: true; likesCount: number }> {
    const result = await this.setReaction(postId, userId, 'LIKE');
    return { liked: true, likesCount: result.likesCount };
  }

  async unlike(postId: string, userId: string): Promise<{ liked: false }> {
    await this.removeReaction(postId, userId);
    return { liked: false };
  }

  async removeReaction(postId: string, userId: string): Promise<{ userReaction: null }> {
    await this.postsService.getVisibleEntityOrFail(postId);
    const existing = await this.reactionRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.reactionRepo.remove(existing);
      await this.adjustCounters(postId, existing.type, -1);
    }
    return { userReaction: null };
  }

  async listByPost(postId: string, query: PaginationQueryDto): Promise<PaginatedResult<Reaction>> {
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

  private async adjustCounters(postId: string, type: ReactionType, delta: number): Promise<void> {
    if (type === 'LIKE') {
      await this.postsService.incrementLikes(postId, delta);
      return;
    }
    await this.postsService.incrementDislikes(postId, delta);
  }

  private likeDelta(from: ReactionType, to: ReactionType): number {
    return (to === 'LIKE' ? 1 : 0) - (from === 'LIKE' ? 1 : 0);
  }

  private dislikeDelta(from: ReactionType, to: ReactionType): number {
    return (to === 'DISLIKE' ? 1 : 0) - (from === 'DISLIKE' ? 1 : 0);
  }
}
