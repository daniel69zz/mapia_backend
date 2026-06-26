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
import { FollowsService, FollowUserSummary } from './follows.service';

@ApiTags('follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @ApiBearerAuth()
  @Post(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seguir a un usuario' })
  follow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    return this.followsService.follow(currentUserId, userId);
  }

  @ApiBearerAuth()
  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dejar de seguir a un usuario' })
  unfollow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    return this.followsService.unfollow(currentUserId, userId);
  }

  @Public()
  @Get(':userId/followers')
  @ApiOperation({ summary: 'Seguidores de un usuario' })
  followers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<FollowUserSummary>> {
    return this.followsService.followers(userId, query);
  }

  @Public()
  @Get(':userId/following')
  @ApiOperation({ summary: 'Usuarios que sigue' })
  following(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<FollowUserSummary>> {
    return this.followsService.following(userId, query);
  }
}
