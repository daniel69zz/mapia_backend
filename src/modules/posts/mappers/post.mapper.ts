import { Post } from '../entities/post.entity';
import { PostResponseDto } from '../dto/post-response.dto';

/** Mapea la entidad Post (con author.profile y media) a su DTO de respuesta. */
export function toPostResponse(
  post: Post,
  userReaction: 'LIKE' | 'DISLIKE' | null = null,
): PostResponseDto {
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
    locationName: post.locationName ?? post.address,
    radiusMeters: post.radiusMeters ?? null,
    showOnMap: post.showOnMap,
    isVerified: post.isVerified,
    isLiked: userReaction === 'LIKE',
    userReaction,
    likesCount: post.likesCount,
    dislikesCount: post.dislikesCount,
    commentsCount: post.commentsCount,
    reportsCount: post.reportsCount,
    author: profile
      ? {
          id: post.authorId ?? '',
          name: profile.name,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          reputation: profile.reputationScore,
        }
      : null,
    media: (post.media ?? []).map((m) => ({ id: m.id, url: m.url, type: m.type })),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
