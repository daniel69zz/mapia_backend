import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiBearerAuth()
  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Comentar una publicación' })
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.create(postId, userId, dto);
  }

  @Public()
  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'Listar comentarios de una publicación' })
  findByPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Comment>> {
    return this.commentsService.findByPost(postId, query);
  }

  @ApiBearerAuth()
  @Delete('comments/:id')
  @ApiOperation({ summary: 'Eliminar comentario (solo autor)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: true }> {
    return this.commentsService.remove(id, userId);
  }
}
