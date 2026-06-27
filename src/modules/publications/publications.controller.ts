import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OptionalAuth } from '@common/decorators/optional-auth.decorator';
import { Public } from '@common/decorators/public.decorator';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { Comment } from '@modules/comments/entities/comment.entity';
import { CommentsService } from '@modules/comments/comments.service';
import { CreateCommentDto } from '@modules/comments/dto/create-comment.dto';
import { CreateReactionDto } from '@modules/reactions/dto/create-reaction.dto';
import { ReactionsService } from '@modules/reactions/reactions.service';
import { ContentReport } from '@modules/reports/entities/content-report.entity';
import { CreateReportDto } from '@modules/reports/dto/create-report.dto';
import { ReportsService } from '@modules/reports/reports.service';
import { PostsService } from '@modules/posts/posts.service';
import { QueryPostsDto } from '@modules/posts/dto/query-posts.dto';
import { PostResponseDto } from '@modules/posts/dto/post-response.dto';

@ApiTags('publications')
@Controller('publications')
export class PublicationsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly reactionsService: ReactionsService,
    private readonly commentsService: CommentsService,
    private readonly reportsService: ReportsService,
  ) {}

  @OptionalAuth()
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Listar publicaciones reales' })
  findAll(
    @Query() query: QueryPostsDto,
    @CurrentUser('userId') currentUserId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.postsService.findAll(query, currentUserId);
  }

  @OptionalAuth()
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de publicacion real' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') currentUserId?: string,
  ): Promise<PostResponseDto> {
    return this.postsService.findOne(id, currentUserId);
  }

  @ApiBearerAuth()
  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Crear o actualizar reaccion' })
  react(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReactionDto,
  ) {
    return this.reactionsService.setReaction(id, userId, dto.type);
  }

  @ApiBearerAuth()
  @Delete(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quitar reaccion' })
  removeReaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reactionsService.removeReaction(id, userId);
  }

  @Get(':id/comments')
  @Public()
  @ApiOperation({ summary: 'Listar comentarios reales' })
  comments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Comment>> {
    return this.commentsService.findByPost(id, query);
  }

  @ApiBearerAuth()
  @Post(':id/comments')
  @ApiOperation({ summary: 'Crear comentario real' })
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.create(id, userId, dto);
  }

  @ApiBearerAuth()
  @Post(':id/reports')
  @ApiOperation({ summary: 'Reportar publicacion' })
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReportDto,
  ): Promise<ContentReport> {
    return this.reportsService.create(id, userId, dto);
  }
}
