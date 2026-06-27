import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { PostsService } from '@modules/posts/posts.service';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    private readonly postsService: PostsService,
  ) {}

  async create(postId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
    await this.postsService.getVisibleEntityOrFail(postId);

    if (dto.parentId) {
      const parent = await this.commentRepo.findOne({ where: { id: dto.parentId, postId } });
      if (!parent) {
        throw new NotFoundException('Comentario padre no encontrado en esta publicación');
      }
    }

    const comment = this.commentRepo.create({
      postId,
      authorId: userId,
      content: dto.content,
      parentId: dto.parentId ?? null,
    });
    const saved = await this.commentRepo.save(comment);
    await this.postsService.incrementComments(postId, 1);
    // Recargar con el autor + perfil para que el frontend pinte el comentario sin refetch.
    return this.commentRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { author: { profile: true } },
    });
  }

  async findByPost(postId: string, query: PaginationQueryDto): Promise<PaginatedResult<Comment>> {
    await this.postsService.getVisibleEntityOrFail(postId);
    const [items, total] = await this.commentRepo.findAndCount({
      where: { postId },
      relations: { author: { profile: true } },
      order: { createdAt: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async remove(id: string, userId: string): Promise<{ success: true }> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('No puedes eliminar este comentario');
    }
    await this.commentRepo.remove(comment);
    await this.postsService.incrementComments(comment.postId, -1);
    return { success: true };
  }
}
