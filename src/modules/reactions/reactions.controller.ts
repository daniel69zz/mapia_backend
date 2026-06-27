import {
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
import { Public } from '@common/decorators/public.decorator';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { Reaction } from './entities/reaction.entity';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@Controller('posts/:postId')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

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
