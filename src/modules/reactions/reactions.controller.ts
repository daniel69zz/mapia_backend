import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { Reaction } from './entities/reaction.entity';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@Controller('posts/:postId')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @ApiBearerAuth()
  @Post('reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Crear o actualizar reaccion de una publicacion' })
  setReaction(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReactionDto,
  ) {
    return this.reactionsService.setReaction(postId, userId, dto.type);
  }

  @ApiBearerAuth()
  @Delete('reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quitar reaccion del usuario autenticado' })
  removeReaction(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reactionsService.removeReaction(postId, userId);
  }

  @ApiBearerAuth()
  @Post('like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dar like a una publicación' })
  like(@Param('postId', ParseUUIDPipe) postId: string, @CurrentUser('userId') userId: string) {
    return this.reactionsService.like(postId, userId);
  }

  @ApiBearerAuth()
  @Delete('like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quitar like' })
  unlike(@Param('postId', ParseUUIDPipe) postId: string, @CurrentUser('userId') userId: string) {
    return this.reactionsService.unlike(postId, userId);
  }

  @Public()
  @Get('reactions')
  @ApiOperation({ summary: 'Listar reacciones de una publicación' })
  list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Reaction>> {
    return this.reactionsService.listByPost(postId, query);
  }
}
