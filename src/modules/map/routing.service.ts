import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapsConfig } from '@core/config/configuration';
import { PostType, PostVisibility } from '@common/enums/post.enums';
import { Post } from '@modules/posts/entities/post.entity';
import { RouteQueryDto } from './dto/route-query.dto';

interface LatLng {
  lat: number;
  lng: number;
}

interface Blockade extends LatLng {
  id: string;
  title: string;
  category: string;
  /** Radio del evento/obstrucción en metros (0 = puntual). */
  radiusMeters: number;
}

export interface RouteResult {
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  /** true si la ruta elegida no pasa por ningún bloqueo. */
  avoidedBlockades: boolean;
  /** Cuántos bloqueos toca la ruta elegida (0 = limpia). */
  blockadesOnRoute: number;
  /** Bloqueos activos considerados en la zona. */
  blockades: Blockade[];
  alternativesCount: number;
}

/** Categorías/alertas que obstruyen el paso y deben evitarse. */
const OBSTRUCTION_CATEGORIES = ['bloqueo', 'marcha', 'accidente', 'incendio', 'emergencia'];
/** Tipos de publicación/evento que obstruyen el paso. */
const OBSTRUCTION_POST_TYPES = [PostType.BLOCKADE, PostType.ACCIDENT];
/** Margen base (m) sobre el punto/radio para considerar que la ruta lo "toca". */
const BLOCK_THRESHOLD_M = 70;
/** Radio mínimo (m) de toda obstrucción, igual al mínimo que muestra el mapa. */
const MIN_EVENT_RADIUS_M = 50;
/** Margen (grados ~) alrededor del corredor para buscar bloqueos. */
const BBOX_MARGIN = 0.06;

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly maps: MapsConfig;

  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    configService: ConfigService,
  ) {
    this.maps = configService.get<MapsConfig>('maps')!;
  }

  async route(dto: RouteQueryDto): Promise<RouteResult> {
    if (!this.maps.apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_MAPS_API_KEY no está configurada en el servidor',
      );
    }

    const blockades = await this.findBlockades(dto);
    const routes = await this.fetchDirections(dto);

    if (routes.length === 0) {
      throw new BadGatewayException('No se encontró ninguna ruta');
    }

    // Evalúa cada alternativa: cuántos bloqueos toca (considerando su RADIO) + duración.
    // Una ruta "toca" un evento si entra en su círculo (radio) + un margen de seguridad.
    const scored = routes.map((r) => {
      const blocked = blockades.filter(
        (b) =>
          distancePointToPath(b, r.points) <= b.radiusMeters + BLOCK_THRESHOLD_M,
      ).length;
      return { ...r, blocked };
    });

    // Prefiere la que toque menos bloqueos; a igualdad, la más rápida.
    scored.sort((a, b) =>
      a.blocked !== b.blocked ? a.blocked - b.blocked : a.durationSeconds - b.durationSeconds,
    );
    const best = scored[0];

    return {
      points: best.points,
      distanceMeters: best.distanceMeters,
      durationSeconds: best.durationSeconds,
      avoidedBlockades: best.blocked === 0,
      blockadesOnRoute: best.blocked,
      blockades,
      alternativesCount: routes.length,
    };
  }

  /** Bloqueos activos dentro del corredor origen-destino. */
  private async findBlockades(dto: RouteQueryDto): Promise<Blockade[]> {
    const minLat = Math.min(dto.originLat, dto.destLat) - BBOX_MARGIN;
    const maxLat = Math.max(dto.originLat, dto.destLat) + BBOX_MARGIN;
    const minLng = Math.min(dto.originLng, dto.destLng) - BBOX_MARGIN;
    const maxLng = Math.max(dto.originLng, dto.destLng) + BBOX_MARGIN;

    // Obstrucciones desde la tabla unificada `posts`:
    //  - eventos que obstruyen (type BLOCKADE/ACCIDENT), con su RADIO
    //  - incidencias (content_type=INCIDENT) cuya categoría obstruye, puntuales
    const posts = await this.postRepo
      .createQueryBuilder('post')
      .where('post.visibility = :vis', { vis: PostVisibility.PUBLIC })
      .andWhere('post.latitude IS NOT NULL AND post.longitude IS NOT NULL')
      .andWhere('post.latitude BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('post.longitude BETWEEN :minLng AND :maxLng', { minLng, maxLng })
      .andWhere(
        `(post.type IN (:...types) OR (post.content_type = :incident AND post.type IN (:...types)) OR (post.content_type = :incident AND (post.details->>'category') IN (:...cats)))`,
        {
          types: OBSTRUCTION_POST_TYPES,
          incident: 'INCIDENT',
          cats: OBSTRUCTION_CATEGORIES,
        },
      )
      .limit(300)
      .getMany();

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      category: this.detailCategory(p) ?? String(p.type).toLowerCase(),
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      // Radio mínimo hardcodeado (50 m) consistente con el círculo del mapa;
      // los eventos con radio mayor lo conservan.
      radiusMeters: Math.max(p.radiusMeters ?? 0, MIN_EVENT_RADIUS_M),
    }));
  }

  private detailCategory(p: Post): string | null {
    const d = p.details;
    if (!d || typeof d !== 'object') return null;
    const v = (d as Record<string, unknown>)['category'];
    return v ? String(v) : null;
  }

  /** Llama a Google Directions con rutas alternativas. */
  private async fetchDirections(
    dto: RouteQueryDto,
  ): Promise<{ points: LatLng[]; distanceMeters: number; durationSeconds: number }[]> {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${dto.originLat},${dto.originLng}`);
    url.searchParams.set('destination', `${dto.destLat},${dto.destLng}`);
    url.searchParams.set('alternatives', 'true');
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('language', 'es');
    url.searchParams.set('key', this.maps.apiKey);

    let data: DirectionsResponse;
    try {
      const res = await fetch(url.toString());
      data = (await res.json()) as DirectionsResponse;
    } catch (error) {
      this.logger.error(`Directions error de red: ${this.errMsg(error)}`);
      throw new BadGatewayException('No se pudo contactar al servicio de rutas');
    }

    if (data.status !== 'OK' || !Array.isArray(data.routes)) {
      this.logger.warn(`Directions status=${data.status}`);
      if (data.status === 'ZERO_RESULTS') return [];
      throw new BadGatewayException(`El servicio de rutas respondió: ${data.status}`);
    }

    return data.routes.map((route) => {
      const legs = route.legs ?? [];
      const distanceMeters = legs.reduce((sum, l) => sum + (l.distance?.value ?? 0), 0);
      const durationSeconds = legs.reduce((sum, l) => sum + (l.duration?.value ?? 0), 0);
      return {
        points: decodePolyline(route.overview_polyline?.points ?? ''),
        distanceMeters,
        durationSeconds,
      };
    });
  }

  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

interface DirectionsResponse {
  status: string;
  routes?: {
    overview_polyline?: { points?: string };
    legs?: { distance?: { value?: number }; duration?: { value?: number } }[];
  }[];
}

/** Decodifica una polilínea codificada de Google a coordenadas. */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Distancia mínima (m) de un punto a una polilínea (mín. por segmento). */
function distancePointToPath(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversine(point, path[0]);

  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distancePointToSegment(point, path[i], path[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

function distancePointToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  // Proyección equirectangular a metros (suficiente a escala urbana).
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lng - p.lng) * mPerDegLng;
  const ay = (a.lat - p.lat) * mPerDegLat;
  const bx = (b.lng - p.lng) * mPerDegLng;
  const by = (b.lat - p.lat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(ax, ay);
  let t = -(ax * dx + ay * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
