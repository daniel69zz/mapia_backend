import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus, PostType, PostVisibility } from '@common/enums/post.enums';

export class PostAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  avatarUrl: string | null;
}

export class PostMediaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ enum: ['IMAGE', 'VIDEO'] })
  type: 'IMAGE' | 'VIDEO';
}

export class PostResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: PostType })
  type: PostType;

  @ApiProperty({ enum: PostStatus })
  status: PostStatus;

  @ApiProperty({ enum: PostVisibility })
  visibility: PostVisibility;

  @ApiProperty()
  latitude: number;

  @ApiProperty()
  longitude: number;

  @ApiPropertyOptional()
  address: string | null;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty({ description: 'Si el usuario autenticado dio like (false si no hay sesión)' })
  isLiked: boolean;

  @ApiProperty()
  likesCount: number;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty()
  reportsCount: number;

  @ApiPropertyOptional({ type: PostAuthorDto })
  author: PostAuthorDto | null;

  @ApiProperty({ type: [PostMediaDto] })
  media: PostMediaDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
