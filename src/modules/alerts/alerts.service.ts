import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoConfig } from '@core/config/configuration';
import { GeoQueryDto } from '@common/dtos/geo-query.dto';
import { POST_TYPE_LABELS, PostType, PostVisibility } from '@common/enums/post.enums';
import { clampRadiusToMeters } from '@common/utils/geo.utils';
import { Post } from '@modules/posts/entities/post.entity';
import { AlertSummaryDto } from './dto/alerts-query.dto';

interface SummaryRow {
  type: PostType;
  count: string;
}

@Injectable()
export class AlertsService {
  private readonly geo: GeoConfig;

  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly configService: ConfigService,
  ) {
    this.geo = this.configService.get<GeoConfig>('geo')!;
  }

  /** Resumen "Hay N bloqueos cerca de ti" agrupado por tipo. */
  async nearbySummary(query: GeoQueryDto): Promise<AlertSummaryDto[]> {
    const effectiveKm = Math.min(
      query.radiusKm && query.radiusKm > 0 ? query.radiusKm : this.geo.defaultRadiusKm,
      this.geo.maxRadiusKm,
    );
    const meters = Math.round(effectiveKm * 1000);

    const rows = await this.postRepo
      .createQueryBuilder('post')
      .select('post.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('post.visibility = :vis', { vis: PostVisibility.PUBLIC })
      .andWhere(
        `ST_DWithin(post.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`,
        { lng: query.lng, lat: query.lat, meters },
      )
      .groupBy('post.type')
      .orderBy('count', 'DESC')
      .getRawMany<SummaryRow>();

    return rows.map((r) => {
      const count = parseInt(r.count, 10);
      const labels = POST_TYPE_LABELS[r.type];
      return {
        type: r.type,
        count,
        title: labels.title,
        description: `Hay ${count} ${labels.plural} cerca de ti`,
        radiusKm: effectiveKm,
      };
    });
  }

  /** Publicaciones cercanas de un tipo concreto (compactas, ordenadas por distancia). */
  async nearbyByType(query: { lat: number; lng: number; radiusKm?: number; type: PostType }) {
    const meters = clampRadiusToMeters(query.radiusKm, this.geo.defaultRadiusKm, this.geo.maxRadiusKm);

    const rows = await this.postRepo
      .createQueryBuilder('post')
      .innerJoin('profiles', 'profile', 'profile.user_id = post.author_id')
      .select('post.id', 'id')
      .addSelect('post.title', 'title')
      .addSelect('post.type', 'type')
      .addSelect('post.latitude', 'latitude')
      .addSelect('post.longitude', 'longitude')
      .addSelect('post.address', 'address')
      .addSelect('post.createdAt', 'createdAt')
      .addSelect('profile.name', 'authorName')
      .addSelect('profile.avatar_url', 'authorAvatarUrl')
      .addSelect(
        `ST_Distance(post.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`,
        'distance',
      )
      .where('post.visibility = :vis', { vis: PostVisibility.PUBLIC })
      .andWhere('post.type = :type', { type: query.type })
      .andWhere(
        `ST_DWithin(post.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`,
        { lng: query.lng, lat: query.lat, meters },
      )
      .orderBy('distance', 'ASC')
      .limit(200)
      .getRawMany();

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      address: r.address,
      distanceMeters: Math.round(Number(r.distance)),
      author: { name: r.authorName, avatarUrl: r.authorAvatarUrl },
      createdAt: r.createdAt,
    }));
  }
}
