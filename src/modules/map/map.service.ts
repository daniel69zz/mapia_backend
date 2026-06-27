import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoConfig } from '@core/config/configuration';
import { PostVisibility } from '@common/enums/post.enums';
import { clampRadiusToMeters, parseBbox } from '@common/utils/geo.utils';
import { Post } from '@modules/posts/entities/post.entity';
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
      // Solo eventos/publicaciones de usuario: las incidencias van por /map/alerts
      // y las noticias por la capa de noticias (evita duplicados en el mapa).
      .andWhere('post.content_type = :ct', { ct: 'EVENT' })
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
    const incidents = await this.loadIncidents(query);
    return { items: incidents.map((p) => this.toIncidentItem(p)) };
  }

  async summary(query: MapAlertsQueryDto) {
    const incidents = await this.loadIncidents(query);
    const productCount = new Map<string, number>();
    const deptCount = new Map<string, number>();
    let highRisk = 0;
    let latest: Date | null = null;
    for (const p of incidents) {
      if (p.severity === 'high') highRisk += 1;
      const product = this.detail(p, 'product');
      if (product) productCount.set(product, (productCount.get(product) ?? 0) + 1);
      const dept = this.detail(p, 'department');
      if (dept) deptCount.set(dept, (deptCount.get(dept) ?? 0) + 1);
      if (!latest || p.createdAt > latest) latest = p.createdAt;
    }
    return {
      totalAlerts: incidents.length,
      highRiskAlerts: highRisk,
      mostAffectedProduct: topKey(productCount),
      mostAffectedDepartment: topKey(deptCount),
      updatedAt: (latest ?? new Date()).toISOString(),
    };
  }

  async filters() {
    const incidents = await this.allIncidents();
    const distinct = (fn: (p: Post) => string | null): string[] =>
      [...new Set(incidents.map(fn).filter((v): v is string => !!v))].sort();

    const alertTypes = distinct((p) => this.detail(p, 'alertType'));
    const severities = distinct((p) => p.severity ?? null);
    return {
      departments: distinct((p) => this.detail(p, 'department')),
      municipalities: distinct((p) => this.detail(p, 'municipality')),
      zones: distinct((p) => this.detail(p, 'zone') ?? p.locationName),
      products: distinct((p) => this.detail(p, 'product')),
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

  /** Lee un valor de `details` (jsonb) como string. */
  private detail(p: Post, key: string): string | null {
    const d = p.details;
    if (!d || typeof d !== 'object') return null;
    const v = (d as Record<string, unknown>)[key];
    return v === null || v === undefined || v === '' ? null : String(v);
  }

  /** Todas las incidencias publicadas (posts content_type=INCIDENT) con media. */
  private async allIncidents(): Promise<Post[]> {
    return this.postRepo.find({
      where: { contentType: 'INCIDENT', visibility: PostVisibility.PUBLIC },
      relations: { media: true },
      order: { createdAt: 'DESC' },
      take: MAX_MARKERS * 2,
    });
  }

  /** Incidencias filtradas en memoria según el query del mapa/alertas. */
  private async loadIncidents(query: MapAlertsQueryDto): Promise<Post[]> {
    const all = await this.allIncidents();
    const result = all.filter((p) => this.matchesAlertQuery(p, query));
    return result.slice(0, MAX_MARKERS);
  }

  private matchesAlertQuery(p: Post, q: MapAlertsQueryDto): boolean {
    const eqCi = (a: string | null, b?: string) =>
      !b || (a !== null && a.toLowerCase() === b.toLowerCase());
    const incCi = (a: string | null, b?: string) =>
      !b || (a !== null && a.toLowerCase().includes(b.toLowerCase()));

    if (!eqCi(this.detail(p, 'department'), q.department)) return false;
    if (!eqCi(this.detail(p, 'municipality'), q.municipality)) return false;
    if (!incCi(this.detail(p, 'zone') ?? p.locationName, q.zone)) return false;
    if (!incCi(this.detail(p, 'product'), q.product)) return false;
    if (q.alertType && this.detail(p, 'alertType') !== q.alertType) return false;
    if (q.severity && p.severity !== q.severity) return false;
    if (q.from && p.createdAt < new Date(q.from)) return false;
    if (q.to && p.createdAt > new Date(q.to)) return false;
    if (
      q.lat !== undefined &&
      q.lng !== undefined &&
      p.latitude !== null &&
      p.longitude !== null
    ) {
      const radiusKm = clampRadiusToMeters(
        q.radiusKm,
        this.geo.defaultRadiusKm,
        this.geo.maxRadiusKm,
      ) / 1000;
      if (haversineKm(q.lat, q.lng, p.latitude, p.longitude) > radiusKm) return false;
    }
    return true;
  }

  private toIncidentItem(p: Post) {
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      product: this.detail(p, 'product'),
      alertType: this.detail(p, 'alertType'),
      severity: p.severity,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      department: this.detail(p, 'department'),
      municipality: this.detail(p, 'municipality'),
      zone: this.detail(p, 'zone') ?? p.locationName,
      reportsCount: 1,
      confidence: this.detail(p, 'confidence')
        ? Number(this.detail(p, 'confidence'))
        : 0.75,
      avgPrice: this.detail(p, 'price') ? Number(this.detail(p, 'price')) : null,
      lastReportedAt: p.createdAt.toISOString(),
      images: (p.media ?? []).map((m) => m.url),
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
      .andWhere('post.show_on_map = true')
      .andWhere('post.content_type = :ct', { ct: 'EVENT' });
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

/** Clave con mayor conteo de un Map (o null si vacío). */
function topKey(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let max = -1;
  for (const [key, count] of counts) {
    if (count > max) {
      max = count;
      best = key;
    }
  }
  return best;
}

/** Distancia en km entre dos puntos (haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
