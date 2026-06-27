import { Post } from '../entities/post.entity';
import { PostResponseDto } from '../dto/post-response.dto';

/** Mapea la entidad Post (con author.profile y media) a su DTO de respuesta. */
export function toPostResponse(post: Post, isLiked = false): PostResponseDto {
  const profile = post.author?.profile;
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    type: post.type,
    status: post.status,
    visibility: post.visibility,
    latitude: Number(post.latitude),
    longitude: Number(post.longitude),
    address: post.address,
    radiusMeters: post.radiusMeters ?? null,
    isVerified: post.isVerified,
    isLiked,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    reportsCount: post.reportsCount,
    author: profile
      ? {
          id: post.authorId,
          name: profile.name,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
        }
      : null,
    media: (post.media ?? []).map((m) => ({ id: m.id, url: m.url, type: m.type })),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
