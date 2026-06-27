import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post as HttpPost,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OptionalAuth } from '@common/decorators/optional-auth.decorator';
import { PaginatedResult } from '@common/dtos/pagination.dto';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { PostResponseDto } from './dto/post-response.dto';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiBearerAuth()
  @HttpPost()
  @ApiOperation({ summary: 'Crear publicación geolocalizada (con imágenes opcionales)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 3 }], {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ): Promise<PostResponseDto> {
    return this.postsService.create(userId, dto, files?.images ?? []);
  }

  @OptionalAuth()
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Listar publicaciones (paginado, filtro por tipo)' })
  findAll(
    @Query() query: QueryPostsDto,
    @CurrentUser('userId') currentUserId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.postsService.findAll(query, currentUserId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Publicaciones del usuario autenticado' })
  findMine(
    @Query() query: QueryPostsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.postsService.findByUser(userId, query, userId);
  }

  @OptionalAuth()
  @ApiBearerAuth()
  @Get('user/:userId')
  @ApiOperation({ summary: 'Publicaciones de un usuario' })
  findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryPostsDto,
    @CurrentUser('userId') currentUserId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.postsService.findByUser(userId, query, currentUserId);
  }

  @OptionalAuth()
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de publicación' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') currentUserId?: string,
  ): Promise<PostResponseDto> {
    return this.postsService.findOne(id, currentUserId);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Editar publicación (solo autor)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar publicación (soft delete, solo autor)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: true }> {
    return this.postsService.remove(id, userId);
  }
}
