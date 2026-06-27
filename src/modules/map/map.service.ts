import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoConfig } from '@core/config/configuration';
import { PostVisibility } from '@common/enums/post.enums';
import { clampRadiusToMeters, parseBbox } from '@common/utils/geo.utils';
import { Post } from '@modules/posts/entities/post.entity';
import { AlertReport } from '@modules/reports/entities/alert-report.entity';
import { MapAlertsQueryDto } from './dto/map-alerts-query.dto';
import { MapBboxQueryDto, MapMarkerDto, MapNearbyQueryDto } from './dto/map-query.dto';
import { MapPublicationsQueryDto } from './dto/map-publications-query.dto';

interface MarkerRow {
  id: string;
  title: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string | null;
  isVerified: boolean;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

const MAX_MARKERS = 500;

@Injectable()
export class MapService {
  private readonly geo: GeoConfig;

  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(AlertReport)
    private readonly alertRepo: Repository<AlertReport>,
    private readonly configService: ConfigService,
  ) {
    this.geo = this.configService.get<GeoConfig>('geo')!;
  }

  /** Publicaciones cercanas a un punto, ordenadas por distancia (PostGIS). */
  async nearby(query: MapNearbyQueryDto): Promise<MapMarkerDto[]> {
    const meters = clampRadiusToMeters(
      query.radiusKm,
      this.geo.defaultRadiusKm,
      this.geo.maxRadiusKm,
    );

    const qb = this.baseMarkerQuery()
      .andWhere(
        `ST_DWithin(post.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`,
        { lng: query.lng, lat: query.lat, meters },
      )
      .addSelect(
        `ST_Distance(post.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`,
        'distance',
      )
      .orderBy('distance', 'ASC')
      .limit(MAX_MARKERS);

    if (query.type) {
      qb.andWhere('post.type = :type', { type: query.type });
    }

    return this.mapRows(await qb.getRawMany<MarkerRow>());
  }

  /** Publicaciones dentro de un bounding box (viewport del mapa). */
  async byBbox(query: MapBboxQueryDto): Promise<MapMarkerDto[]> {
    let box: ReturnType<typeof parseBbox>;
    try {
      box = parseBbox(query.bbox);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const qb = this.baseMarkerQuery()
      .andWhere(
        `post.location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)::geography`,
        box,
      )
      .orderBy('post.createdAt', 'DESC')
      .limit(MAX_MARKERS);

    if (query.type) {
      qb.andWhere('post.type = :type', { type: query.type });
    }

    return this.mapRows(await qb.getRawMany<MarkerRow>());
  }

  /**
   * Publicaciones (marcadores) para el mapa, opcionalmente dentro del viewport.
   * Devuelve el shape que consume MapPublicationMarkerEntity del frontend.
   */
  async publications(query: MapPublicationsQueryDto) {
    const qb = this.postRepo
      .createQueryBuilder('post')
      .innerJoin('profiles', 'profile', 'profile.user_id = post.author_id')
      .select('post.id', 'publicationId')
      .addSelect('post.title', 'title')
      .addSelect('post.latitude', 'latitude')
      .addSelect('post.longitude', 'longitude')
      .addSelect('post.address', 'address')
      .addSelect('post.location_name', 'locationName')
      .addSelect('post.radius_meters', 'radiusMeters')
      .addSelect('post.show_on_map', 'showOnMap')
      .addSelect('post.type', 'category')
      .addSelect('post.created_at', 'createdAt')
      .addSelect('profile.user_id', 'userId')
      .addSelect('profile.name', 'userName')
      .addSelect('profile.avatar_url', 'userProfileImageUrl')
      .addSelect('profile.likes_count', 'userReputation')
      .where('post.visibility = :vis', { vis: PostVisibility.PUBLIC })
      .andWhere('post.show_on_map = true')
      .orderBy('post.created_at', 'DESC')
      .limit(MAX_MARKERS);

    if (
      query.north !== undefined &&
      query.south !== undefined &&
      query.east !== undefined &&
      query.west !== undefined
    ) {
      qb.andWhere('post.latitude BETWEEN :south AND :north', {
        south: query.south,
        north: query.north,
      }).andWhere('post.longitude BETWEEN :west AND :east', {
        west: query.west,
        east: query.east,
      });
    }

    const rows = await qb.getRawMany<{
      publicationId: string;
      title: string;
      latitude: number;
      longitude: number;
      address: string | null;
      locationName: string | null;
      radiusMeters: number | null;
      showOnMap: boolean;
      category: string;
      createdAt: Date;
      userId: string;
      userName: string;
      userProfileImageUrl: string | null;
      userReputation: number | null;
    }>();

    return {
      items: rows.map((r) => ({
        publicationId: r.publicationId,
        title: r.title,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        address: r.address,
        locationName: r.locationName ?? r.address,
        radiusMeters:
          r.radiusMeters === null || r.radiusMeters === undefined
            ? 0
            : Number(r.radiusMeters),
        showOnMap: Boolean(r.showOnMap),
        userId: r.userId,
        userName: r.userName,
        userProfileImageUrl: r.userProfileImageUrl,
        userReputation:
          r.userReputation === null ? null : Number(r.userReputation),
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        category: r.category,
        markerType: 'publication',
      })),
    };
  }

  async alerts(query: MapAlertsQueryDto) {
    const qb = this.filteredAlertsQuery(query)
      .leftJoinAndSelect('report.images', 'image')
      .orderBy('report.createdAt', 'DESC')
      .limit(MAX_MARKERS);

    const reports = await qb.getMany();

    return {
      items: reports.map((report) => ({
        id: report.id,
        title: report.title,
        description: report.description,
        product: report.product,
        alertType: report.alertType,
        severity: report.severity,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        department: report.department,
        municipality: report.municipality,
        zone: report.zone,
        reportsCount: 1,
        confidence: report.confidence === null ? 0.75 : Number(report.confidence),
        avgPrice: report.price === null ? null : Number(report.price),
        lastReportedAt: report.createdAt.toISOString(),
        images: (report.images ?? []).map((image) => image.url),
      })),
    };
  }

  async summary(query: MapAlertsQueryDto) {
    const [totalAlerts, highRiskAlerts, productRows, departmentRows, latest] = await Promise.all([
      this.filteredAlertsQuery(query).getCount(),
      this.filteredAlertsQuery({ ...query, severity: 'high' }).getCount(),
      this.filteredAlertsQuery(query)
        .select('report.product', 'value')
        .addSelect('COUNT(*)', 'count')
        .andWhere('report.product IS NOT NULL')
        .groupBy('report.product')
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawMany<{ value: string; count: string }>(),
      this.filteredAlertsQuery(query)
        .select('report.department', 'value')
        .addSelect('COUNT(*)', 'count')
        .andWhere('report.department IS NOT NULL')
        .groupBy('report.department')
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawMany<{ value: string; count: string }>(),
      this.filteredAlertsQuery(query).orderBy('report.createdAt', 'DESC').getOne(),
    ]);

    return {
      totalAlerts,
      highRiskAlerts,
      mostAffectedProduct: productRows[0]?.value ?? null,
      mostAffectedDepartment: departmentRows[0]?.value ?? null,
      updatedAt: latest?.createdAt.toISOString() ?? new Date().toISOString(),
    };
  }

  async filters() {
    const [departments, municipalities, zones, products, alertTypes, severities] =
      await Promise.all([
        this.distinctReportValues('department'),
        this.distinctReportValues('municipality'),
        this.distinctReportValues('zone'),
        this.distinctReportValues('product'),
        this.distinctReportValues('alertType'),
        this.distinctReportValues('severity'),
      ]);

    return {
      departments,
      municipalities,
      zones,
      products,
      alertTypes: alertTypes.length
        ? alertTypes
        : [
            'stock_bajo',
            'sobreprecio',
            'bloqueo',
            'retraso_proveedor',
            'combustible',
            'producto_no_disponible',
            'otro',
          ],
      severities: severities.length ? severities : ['normal', 'low', 'medium', 'high'],
    };
  }

  private baseMarkerQuery() {
    return this.postRepo
      .createQueryBuilder('post')
      .innerJoin('profiles', 'profile', 'profile.user_id = post.author_id')
      .select('post.id', 'id')
      .addSelect('post.title', 'title')
      .addSelect('post.type', 'type')
      .addSelect('post.latitude', 'latitude')
      .addSelect('post.longitude', 'longitude')
      .addSelect('post.address', 'address')
      .addSelect('post.isVerified', 'isVerified')
      .addSelect('profile.user_id', 'authorId')
      .addSelect('profile.name', 'authorName')
      .addSelect('profile.avatar_url', 'authorAvatarUrl')
      .where('post.visibility = :vis', { vis: PostVisibility.PUBLIC })
      .andWhere('post.show_on_map = true');
  }

  private filteredAlertsQuery(query: MapAlertsQueryDto) {
    const qb = this.alertRepo
      .createQueryBuilder('report')
      .where('report.status = :status', { status: 'active' });

    if (query.department) {
      qb.andWhere('LOWER(report.department) = LOWER(:department)', {
        department: query.department,
      });
    }
    if (query.municipality) {
      qb.andWhere('LOWER(report.municipality) = LOWER(:municipality)', {
        municipality: query.municipality,
      });
    }
    if (query.zone) {
      qb.andWhere('LOWER(report.zone) LIKE LOWER(:zone)', { zone: `%${query.zone}%` });
    }
    if (query.product) {
      qb.andWhere('LOWER(report.product) LIKE LOWER(:product)', {
        product: `%${query.product}%`,
      });
    }
    if (query.alertType) {
      qb.andWhere('report.alertType = :alertType', { alertType: query.alertType });
    }
    if (query.severity) {
      qb.andWhere('report.severity = :severity', { severity: query.severity });
    }
    if (query.from) {
      qb.andWhere('report.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('report.createdAt <= :to', { to: query.to });
    }
    if (query.lat !== undefined && query.lng !== undefined) {
      const meters = clampRadiusToMeters(
        query.radiusKm,
        this.geo.defaultRadiusKm,
        this.geo.maxRadiusKm,
      );
      qb.andWhere(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(report.longitude, report.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :meters
        )`,
        { lng: query.lng, lat: query.lat, meters },
      );
    }

    return qb;
  }

  private async distinctReportValues(field: keyof AlertReport): Promise<string[]> {
    const rows = await this.alertRepo
      .createQueryBuilder('report')
      .select(`report.${String(field)}`, 'value')
      .where(`report.${String(field)} IS NOT NULL`)
      .andWhere('report.status = :status', { status: 'active' })
      .groupBy(`report.${String(field)}`)
      .orderBy(`report.${String(field)}`, 'ASC')
      .getRawMany<{ value: string }>();

    return rows.map((row) => row.value).filter(Boolean);
  }

  private mapRows(rows: MarkerRow[]): MapMarkerDto[] {
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type as MapMarkerDto['type'],
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      address: r.address,
      isVerified: Boolean(r.isVerified),
      author: {
        id: r.authorId,
        name: r.authorName,
        avatarUrl: r.authorAvatarUrl,
      },
    }));
  }
}
