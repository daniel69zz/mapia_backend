import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { Profile } from '@modules/profiles/entities/profile.entity';
import { ProfilesService } from '@modules/profiles/profiles.service';
import { UsersService } from '@modules/users/users.service';
import { Follow } from './entities/follow.entity';

export interface FollowUserSummary {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly profilesService: ProfilesService,
    private readonly usersService: UsersService,
  ) {}

  async follow(followerId: string, targetId: string): Promise<{ following: true }> {
    if (followerId === targetId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }
    await this.usersService.findByIdOrFail(targetId);

    const existing = await this.followRepo.findOne({
      where: { followerId, followingId: targetId },
    });
    if (existing) {
      throw new ConflictException('Ya sigues a este usuario');
    }

    await this.followRepo.save(this.followRepo.create({ followerId, followingId: targetId }));
    await this.profilesService.incrementFollowing(followerId, 1);
    await this.profilesService.incrementFollowers(targetId, 1);
    return { following: true };
  }

  async unfollow(followerId: string, targetId: string): Promise<{ following: false }> {
    const existing = await this.followRepo.findOne({
      where: { followerId, followingId: targetId },
    });
    if (existing) {
      await this.followRepo.remove(existing);
      await this.profilesService.incrementFollowing(followerId, -1);
      await this.profilesService.incrementFollowers(targetId, -1);
    }
    return { following: false };
  }

  /** Usuarios que siguen a :userId */
  async followers(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<FollowUserSummary>> {
    const [rows, total] = await this.followRepo.findAndCount({
      where: { followingId: userId },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    const summaries = await this.toSummaries(rows.map((r) => r.followerId));
    return new PaginatedResult(summaries, total, query.page, query.limit);
  }

  /** Usuarios a los que :userId sigue */
  async following(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<FollowUserSummary>> {
    const [rows, total] = await this.followRepo.findAndCount({
      where: { followerId: userId },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    const summaries = await this.toSummaries(rows.map((r) => r.followingId));
    return new PaginatedResult(summaries, total, query.page, query.limit);
  }

  private async toSummaries(userIds: string[]): Promise<FollowUserSummary[]> {
    if (userIds.length === 0) return [];
    const profiles = await this.profileRepo.find({ where: userIds.map((userId) => ({ userId })) });
    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    return userIds
      .map((id) => byUser.get(id))
      .filter((p): p is Profile => Boolean(p))
      .map((p) => ({
        userId: p.userId,
        username: p.username,
        name: p.name,
        avatarUrl: p.avatarUrl,
      }));
  }
}
