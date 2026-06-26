import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@common/dtos/pagination.dto';
import { PostType } from '@common/enums/post.enums';

export class QueryPostsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}
