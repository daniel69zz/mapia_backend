import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { PostStatus, PostType, PostVisibility } from '@common/enums/post.enums';
import { ReportReason } from '@common/enums/report-reason.enum';
import { IStorageService, STORAGE_SERVICE } from '@core/storage/storage.types';
import { IImageAnalyzer, IMAGE_ANALYZER } from '@core/ai/ai.types';
import { Post } from '@modules/posts/entities/post.entity';
import { PostsService } from '@modules/posts/posts.service';
import { PostMedia } from '@modules/post-media/entities/post-media.entity';
import { ContentReport } from './entities/content-report.entity';
import { AlertType, ReportSeverity } from './entities/alert-report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateCitizenReportDto } from './dto/create-citizen-report.dto';
import { ParseCitizenReportDto } from './dto/parse-citizen-report.dto';

const BOLIVIA_BOUNDS = {
  minLat: -22.9,
  maxLat: -9.6,
  minLng: -69.7,
  maxLng: -57.4,
};

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const CRITICAL_PRODUCTS = [
  'arroz',
  'azucar',
  'aceite',
  'harina',
  'pan',
  'gasolina',
  'diesel',
  'garrafa',
  'agua',
  'medicamentos',
];

const PRODUCT_ALIASES: Record<string, string[]> = {
  arroz: ['arroz'],
  azucar: ['azucar', 'azúcar'],
  aceite: ['aceite'],
  harina: ['harina'],
  pan: ['pan'],
  gasolina: ['gasolina', 'nafta'],
  diesel: ['diesel', 'diésel'],
  garrafa: ['garrafa', 'gas'],
  agua: ['agua'],
  medicamentos: ['medicamento', 'medicamentos', 'farmacia'],
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostMedia)
    private readonly postMediaRepo: Repository<PostMedia>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: IStorageService,
    @Inject(IMAGE_ANALYZER)
    private readonly imageAnalyzer: IImageAnalyzer,
    private readonly postsService: PostsService,
  ) {}

  parseCitizenReport(dto: ParseCitizenReportDto) {
    const normalized = normalize(dto.text);
    const product = detectProduct(normalized);
    const alertType = detectAlertType(normalized, product);
    const severity = detectSeverity(normalized, alertType, product);
    const price = detectPrice(normalized);
    const location = inferLocation(dto.text, dto.latitude, dto.longitude);
    const productLabel = product ? restoreProductLabel(product) : 'abastecimiento';

    return {
      title: buildTitle(alertType, productLabel, severity),
      description: summarize(dto.text, productLabel, alertType),
      product: productLabel,
      alertType,
      severity,
      price,
      department: location.department,
      municipality: location.municipality,
      zone: location.zone,
      confidence: confidenceScore(dto.text, product, location.zone),
    };
  }

  /**
   * Igual que parseCitizenReport pero, si hay imágenes y la IA de visión está
   * habilitada, refina título/descripción con el análisis de la primera foto.
   * Si la IA está apagada o falla, devuelve el parseo de texto (nunca rompe).
   */
  async parseCitizenReportWithImages(dto: ParseCitizenReportDto, images: Express.Multer.File[]) {
    const base = this.parseCitizenReport(dto);

    const image = images?.[0];
    if (!image || !isAllowedImage(image)) {
      return base;
    }

    try {
      const analysis = await this.imageAnalyzer.analyzeImage({
        buffer: image.buffer,
        mimeType: image.mimetype,
      });
      if (!analysis || analysis.confidence < 0.5) {
        return base;
      }
      return {
        ...base,
        title: analysis.title?.trim() ? analysis.title : base.title,
        description: analysis.description?.trim() ? analysis.description : base.description,
        confidence: Math.max(base.confidence, analysis.confidence),
      };
    } catch {
      // IA deshabilitada o sin credenciales: se conserva el parseo de texto.
      return base;
    }
  }

  async createCitizenReport(
    dto: CreateCitizenReportDto,
    images: Express.Multer.File[],
    userId?: string,
  ): Promise<{ id: string; postId?: string; status: 'created'; message: string }> {
    this.assertInsideBolivia(dto.latitude, dto.longitude);
    if (images.length > 3) {
      throw new BadRequestException('Solo puedes subir hasta 3 imagenes');
    }
    for (const image of images) {
      if (!isAllowedImage(image)) {
        throw new BadRequestException('Las imagenes deben ser JPG, PNG o WEBP');
      }
    }

    // Tabla unificada: una incidencia es un `post` con content_type=INCIDENT.
    const post = this.postRepo.create({
      authorId: userId ?? null,
      title: dto.title,
      description: dto.description ?? dto.sourceText ?? dto.title,
      type: mapToPostType(dto.category ?? null, dto.alertType),
      contentType: 'INCIDENT',
      authorType: userId ? 'USER' : 'AI',
      severity: dto.severity,
      latitude: dto.latitude,
      longitude: dto.longitude,
      address: buildAddress(dto.zone, dto.municipality, dto.department),
      locationName: dto.zone ?? null,
      showOnMap: true,
      status: PostStatus.PUBLISHED,
      visibility: PostVisibility.PUBLIC,
      details: {
        alertType: dto.alertType,
        category: dto.category ?? null,
        department: dto.department ?? null,
        municipality: dto.municipality ?? null,
        zone: dto.zone ?? null,
        product: dto.product ?? null,
        price: dto.price ?? null,
        confidence: dto.confidence ?? 0.75,
        ...(parseDetails(dto.details) ?? {}),
      },
    });

    const saved = await this.postRepo.save(post);

    for (const image of images) {
      const stored = await this.storage.upload({
        buffer: image.buffer,
        originalName: image.originalname,
        mimeType: image.mimetype,
        folder: `posts/${saved.id}`,
      });
      await this.postMediaRepo.save(
        this.postMediaRepo.create({
          postId: saved.id,
          url: stored.url,
          storageKey: stored.storageKey,
          type: 'IMAGE',
        }),
      );
    }

    return {
      id: saved.id,
      postId: saved.id,
      status: 'created',
      message: 'Reporte publicado correctamente',
    };
  }

  async create(postId: string, reporterId: string, dto: CreateReportDto): Promise<ContentReport> {
    await this.postsService.getVisibleEntityOrFail(postId);

    // Un usuario no reporta dos veces la misma publicación.
    const existing = await this.reportRepo.findOne({ where: { postId, reporterId } });
    if (existing) {
      throw new ConflictException('Ya reportaste esta publicación');
    }

    const report = this.reportRepo.create({
      postId,
      reporterId,
      reason: normalizeReportReason(dto.reason),
      description: dto.description ?? null,
    });
    const saved = await this.reportRepo.save(report);
    await this.postsService.incrementReports(postId, 1);
    return saved;
  }

  /**
   * Reportes ciudadanos (con imagen/IA) publicados cerca de un punto.
   * Usa PostGIS: ST_DWithin sobre geography(Point,4326) + ST_Distance para ordenar.
   */
  async findNearby(lat: number, lng: number, radius = 1500, category?: string) {
    const rows = await this.postRepo.query(
      `SELECT id, title, description, latitude, longitude,
              (details->>'category') AS category,
              severity, created_at AS "createdAt",
              ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS "distanceMeters"
         FROM posts
        WHERE content_type = 'INCIDENT'
          AND visibility = 'PUBLIC'
          AND location IS NOT NULL
          AND ($4::text IS NULL OR (details->>'category') = $4)
          AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY "distanceMeters" ASC
        LIMIT 100`,
      [lng, lat, radius, category ?? null],
    );
    return { items: rows, count: rows.length };
  }

  /** Listado para moderación (MODERATOR/ADMIN). */
  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<ContentReport>> {
    const [items, total] = await this.reportRepo.findAndCount({
      relations: { reporter: true, post: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  private assertInsideBolivia(lat: number, lng: number): void {
    const inside =
      lat >= BOLIVIA_BOUNDS.minLat &&
      lat <= BOLIVIA_BOUNDS.maxLat &&
      lng >= BOLIVIA_BOUNDS.minLng &&
      lng <= BOLIVIA_BOUNDS.maxLng;

    if (!inside) {
      throw new BadRequestException('La ubicacion del reporte debe estar dentro de Bolivia');
    }
  }

}

function normalizeReportReason(reason: string): ReportReason {
  if (reason === 'FALSE_INFORMATION') return ReportReason.FALSE_INFO;
  if (reason === 'INAPPROPRIATE') return ReportReason.OFFENSIVE;
  if (reason === 'FALSE_INFO') return ReportReason.FALSE_INFO;
  if (reason === 'OFFENSIVE') return ReportReason.OFFENSIVE;
  if (reason === 'DANGEROUS') return ReportReason.DANGEROUS;
  if (reason === 'SPAM') return ReportReason.SPAM;
  return ReportReason.OTHER;
}

function isAllowedImage(file: Express.Multer.File): boolean {
  if (IMAGE_MIME.includes(file.mimetype)) return true;
  const name = (file.originalname ?? '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext));
}

function parseDetails(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectProduct(text: string): string | null {
  for (const [product, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some((alias) => text.includes(normalize(alias)))) {
      return product;
    }
  }
  return null;
}

function detectAlertType(text: string, product: string | null): AlertType {
  if (text.includes('bloqueo') || text.includes('cerrada') || text.includes('ruta')) {
    return 'bloqueo';
  }
  if (product === 'gasolina' || product === 'diesel' || text.includes('combustible')) {
    return 'combustible';
  }
  if (
    text.includes('no hay') ||
    text.includes('agot') ||
    text.includes('sin stock') ||
    text.includes('falta')
  ) {
    return 'producto_no_disponible';
  }
  if (text.includes('stock bajo') || text.includes('poco') || text.includes('escase')) {
    return 'stock_bajo';
  }
  if (
    text.includes('subio') ||
    text.includes('caro') ||
    text.includes('sobreprecio') ||
    text.includes('bs')
  ) {
    return 'sobreprecio';
  }
  if (text.includes('retras') || text.includes('no llego') || text.includes('proveedor')) {
    return 'retraso_proveedor';
  }
  return 'otro';
}

function detectSeverity(
  text: string,
  alertType: AlertType,
  product: string | null,
): ReportSeverity {
  if (
    alertType === 'bloqueo' ||
    alertType === 'combustible' ||
    text.includes('critico') ||
    text.includes('urgente') ||
    text.includes('no hay') ||
    (product && CRITICAL_PRODUCTS.includes(product) && alertType === 'producto_no_disponible')
  ) {
    return 'high';
  }
  if (
    alertType === 'stock_bajo' ||
    alertType === 'sobreprecio' ||
    alertType === 'retraso_proveedor' ||
    text.includes('casi no hay')
  ) {
    return 'medium';
  }
  if (alertType !== 'otro') {
    return 'low';
  }
  return 'normal';
}

function detectPrice(text: string): number | null {
  const match = text.match(
    /(?:bs\.?|bolivianos?)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:bs\.?|bolivianos?)?/i,
  );
  return match ? Number(match[1].replace(',', '.')) : null;
}

function inferLocation(source: string, lat?: number, lng?: number) {
  const text = normalize(source);
  let department = lat && lng ? departmentFromCoordinates(lat, lng) : 'La Paz';
  let municipality = department === 'Santa Cruz' ? 'Santa Cruz de la Sierra' : department;
  let zone = '';

  if (text.includes('mercado rodriguez')) {
    department = 'La Paz';
    municipality = 'La Paz';
    zone = 'Mercado Rodriguez';
  } else if (text.includes('achocalla')) {
    department = 'La Paz';
    municipality = 'Achocalla';
    zone = 'Ruta a Achocalla';
  } else if (text.includes('el alto')) {
    department = 'La Paz';
    municipality = 'El Alto';
    zone = 'El Alto';
  } else if (text.includes('abasto')) {
    department = 'Santa Cruz';
    municipality = 'Santa Cruz de la Sierra';
    zone = 'Mercado Abasto';
  }

  return { department, municipality, zone };
}

function departmentFromCoordinates(lat: number, lng: number): string {
  if (lat < -17.0 && lng > -64.5) return 'Santa Cruz';
  if (lat < -17.0 && lng <= -64.5 && lng > -67.8) return 'Cochabamba';
  if (lat < -18.3 && lng <= -67.8) return 'Oruro';
  if (lat > -15.5 && lng > -66.5) return 'Beni';
  if (lat > -15.0 && lng <= -66.5) return 'La Paz';
  if (lat < -19.0 && lng > -65.8) return 'Chuquisaca';
  if (lat < -20.0 && lng <= -65.8) return 'Potosi';
  return 'La Paz';
}

function restoreProductLabel(product: string): string {
  if (product === 'azucar') return 'azucar';
  if (product === 'diesel') return 'diesel';
  return product;
}

function buildTitle(alertType: AlertType, product: string, severity: ReportSeverity): string {
  const prefix = severity === 'high' ? 'Alerta alta' : severity === 'medium' ? 'Riesgo' : 'Reporte';
  const labels: Record<AlertType, string> = {
    stock_bajo: `stock bajo de ${product}`,
    sobreprecio: `sobreprecio de ${product}`,
    bloqueo: 'bloqueo reportado',
    retraso_proveedor: `retraso de proveedor de ${product}`,
    combustible: 'problema de combustible',
    producto_no_disponible: `${product} no disponible`,
    otro: `situacion de ${product}`,
  };
  return `${prefix}: ${labels[alertType]}`;
}

function summarize(text: string, product: string, alertType: AlertType): string {
  const clean = text.trim();
  if (clean.length <= 260) {
    return clean;
  }
  return `Reporte ciudadano sobre ${product} (${alertType}): ${clean.slice(0, 240)}...`;
}

function confidenceScore(text: string, product: string | null, zone: string): number {
  let score = 0.58;
  if (product) score += 0.12;
  if (zone) score += 0.1;
  if (detectPrice(normalize(text)) !== null) score += 0.08;
  if (text.length > 30) score += 0.06;
  return Math.min(0.94, Number(score.toFixed(2)));
}

function mapToPostType(rawCategory: string | null, alertType: AlertType | null): PostType {
  const category = normalize(String(rawCategory ?? ''));

  if (
    [
      'fiesta',
      'celebracion',
      'evento_comunitario',
      'concierto_libre',
      'feria',
      'entrada_folklorica',
      'cultura',
      'deporte',
    ].includes(category)
  ) {
    return PostType.PARTY;
  }
  if (['descuento', 'promocion', 'abastecimiento', 'combustible'].includes(category)) {
    return PostType.SALE;
  }
  if (category === 'transporte') {
    return PostType.TRAFFIC;
  }
  if (category === 'bloqueo' || category === 'marcha' || alertType === 'bloqueo') {
    return PostType.BLOCKADE;
  }
  if (category === 'accidente') {
    return PostType.ACCIDENT;
  }
  if (category === 'servicio_publico') {
    return PostType.SERVICE_CUT;
  }
  if (category === 'seguridad') {
    return PostType.SECURITY;
  }
  if (category === 'incendio' || category === 'emergencia' || category === 'salud') {
    return PostType.NEWS;
  }
  return PostType.OTHER;
}

function buildAddress(
  zone?: string | null,
  municipality?: string | null,
  department?: string | null,
): string | null {
  const parts = [zone, municipality, department]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(', ') : null;
}
