import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import { MapNewsCategory, MapNewsItem } from './news.types';
import { GeneratedNewsPost } from './entities/generated-news-post.entity';

interface RssItem {
  title: string;
  url: string;
  description: string | null;
  publishedAt: string;
}

/** Lugar conocido de Bolivia con sus coordenadas aproximadas (centro). */
interface KnownPlace {
  /** Texto que se busca dentro del título/descripción (sin acentos, minúsculas). */
  keywords: string[];
  label: string;
  lat: number;
  lng: number;
}

/**
 * Diccionario simple para geolocalizar noticias por mención de ciudad/zona.
 * No pretende ser exhaustivo: solo localizar lo más común en titulares.
 */
const KNOWN_PLACES: KnownPlace[] = [
  { keywords: ['el alto'], label: 'El Alto', lat: -16.5047, lng: -68.1633 },
  {
    keywords: ['la paz', 'sopocachi', 'miraflores', 'san miguel', 'calacoto'],
    label: 'La Paz',
    lat: -16.5,
    lng: -68.15,
  },
  {
    keywords: ['santa cruz', 'montero', 'warnes'],
    label: 'Santa Cruz',
    lat: -17.7833,
    lng: -63.1821,
  },
  {
    keywords: ['cochabamba', 'quillacollo', 'sacaba'],
    label: 'Cochabamba',
    lat: -17.3895,
    lng: -66.1568,
  },
  { keywords: ['oruro'], label: 'Oruro', lat: -17.9833, lng: -67.15 },
  { keywords: ['potosi'], label: 'Potosí', lat: -19.5836, lng: -65.7531 },
  { keywords: ['sucre', 'chuquisaca'], label: 'Sucre', lat: -19.0333, lng: -65.2627 },
  { keywords: ['tarija', 'yacuiba'], label: 'Tarija', lat: -21.5355, lng: -64.7296 },
  { keywords: ['trinidad', 'beni'], label: 'Trinidad', lat: -14.8333, lng: -64.9 },
  { keywords: ['cobija', 'pando'], label: 'Cobija', lat: -11.0267, lng: -68.7692 },
  { keywords: ['riberalta'], label: 'Riberalta', lat: -10.9833, lng: -66.1 },
  { keywords: ['bolivia'], label: 'Bolivia', lat: -16.5, lng: -64.5 },
];

/** Reglas de categorización por palabras clave del titular. */
const CATEGORY_RULES: { category: MapNewsCategory; keywords: string[] }[] = [
  {
    category: 'bloqueo',
    keywords: [
      'bloqueo',
      'bloquea',
      'marcha',
      'paro',
      'protesta',
      'manifestaci',
      'huelga',
      'avasalla',
    ],
  },
  {
    category: 'corte_servicio',
    keywords: [
      'corte de agua',
      'corte de luz',
      'sin agua',
      'sin luz',
      'apagon',
      'racionamiento',
      'corte de gas',
    ],
  },
  {
    category: 'evento',
    keywords: [
      'festival',
      'concierto',
      'fiesta',
      'feria',
      'carnaval',
      'entrada',
      'festividad',
      'evento',
      'expo',
    ],
  },
  {
    category: 'venta',
    keywords: ['venta', 'oferta', 'precio', 'mercado', 'descuento', 'promocion'],
  },
];

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  private static readonly sourceName = 'El Deber';
  private static readonly rssUrls = ['https://eldeber.com.bo/feed', 'https://eldeber.com.bo/rss'];

  private readonly parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

  constructor(
    @InjectRepository(GeneratedNewsPost)
    private readonly repo: Repository<GeneratedNewsPost>,
  ) {}

  /** Descarga y parsea el primer RSS que devuelva ítems. */
  private async fetchRssItems(): Promise<RssItem[]> {
    for (const url of NewsService.rssUrls) {
      try {
        const xml = await this.fetchRss(url);
        const parsed = this.parseRss(xml);
        if (parsed.length > 0) return parsed;
      } catch (error) {
        this.logger.warn(
          `RSS ${url} falló: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return [];
  }

  /**
   * Noticias del día geolocalizadas para el mapa. Best-effort: si el RSS no
   * responde o ninguna noticia es localizable, devuelve una lista vacía.
   */
  async getTodayMapNews(): Promise<MapNewsItem[]> {
    const rawItems = await this.fetchRssItems();
    if (rawItems.length === 0) return [];

    const recent = this.filterRecent(rawItems);

    const mapped: MapNewsItem[] = [];
    for (const item of recent) {
      const place = this.locate(`${item.title} ${item.description ?? ''}`);
      if (!place) continue; // sin ubicación no se puede pintar en el mapa
      mapped.push({
        id: this.stableId(item.url),
        title: item.title,
        description: item.description,
        source: NewsService.sourceName,
        url: item.url,
        publishedAt: item.publishedAt,
        locationText: place.label,
        lat: place.lat,
        lng: place.lng,
        category: this.categorize(`${item.title} ${item.description ?? ''}`),
        createdBy: 'rss',
        locationStatus: 'localized',
      });
    }
    return mapped;
  }

  /** Publicaciones de noticias persistidas para Explorar (más recientes primero). */
  async getGeneratedPosts() {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      source: r.source,
      originalUrl: r.originalUrl,
      category: r.category,
      status: r.status,
      generatedBy: r.generatedBy,
      isAiGenerated: r.isAiGenerated,
      mapItemId: r.mapItemId,
      locationText: r.locationText,
      lat: r.lat,
      lng: r.lng,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Estado de la ingestión de noticias. */
  async getStatus() {
    const total = await this.repo.count();
    const latest = await this.repo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
    return {
      lastPollTime: latest ? latest.createdAt.toISOString() : null,
      totalNewsDetected: total,
      totalPostsGenerated: total,
      activeSources: [NewsService.sourceName],
      configuredInterval: 'Manual / bajo demanda',
    };
  }

  /** Ingesta el RSS de El Deber y persiste las noticias nuevas (dedupe por URL). */
  async refresh(): Promise<{ inserted: number; detected: number }> {
    const rawItems = await this.fetchRssItems();
    let inserted = 0;

    for (const item of rawItems) {
      const exists = await this.repo.findOne({
        where: { originalUrl: item.url },
        select: { id: true },
      });
      if (exists) continue;

      const text = `${item.title} ${item.description ?? ''}`;
      const place = this.locate(text);
      const entity = this.repo.create({
        title: item.title,
        content: item.description ?? item.title,
        source: NewsService.sourceName,
        originalUrl: item.url,
        category: this.categorize(text),
        status: 'published',
        generatedBy: 'rss_polling',
        isAiGenerated: true,
        locationText: place?.label ?? null,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        publishedAt: new Date(item.publishedAt),
      });
      try {
        await this.repo.save(entity);
        inserted += 1;
      } catch (error) {
        // Carrera de duplicados (índice único): se ignora.
        this.logger.warn(`No se guardó noticia: ${this.errMsg(error)}`);
      }
    }

    return { inserted, detected: rawItems.length };
  }

  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async fetchRss(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
        'User-Agent': 'MAPIA news map reader',
      },
    });
    if (!response.ok) {
      throw new Error(`El RSS respondió con estado ${response.status}.`);
    }
    return response.text();
  }

  private parseRss(
    xml: string,
  ): { title: string; url: string; description: string | null; publishedAt: string }[] {
    const parsed = this.parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
    const rawItems = parsed.rss?.channel?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    const result: {
      title: string;
      url: string;
      description: string | null;
      publishedAt: string;
    }[] = [];
    for (const raw of items) {
      if (!this.isRecord(raw)) continue;
      const title = this.asText(raw.title);
      const url = this.asText(raw.link);
      if (!title || !url) continue;
      result.push({
        title,
        url,
        description: this.cleanDescription(this.asText(raw.description)) ?? null,
        publishedAt: this.toIsoDate(this.asText(raw.pubDate)) ?? new Date().toISOString(),
      });
    }
    return result;
  }

  /** Noticias de las últimas 36h; si no hay ninguna, las 15 más recientes. */
  private filterRecent<T extends { publishedAt: string }>(items: T[]): T[] {
    const cutoff = Date.now() - 36 * 60 * 60 * 1000;
    const recent = items.filter((item) => {
      const t = new Date(item.publishedAt).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    return recent.length > 0 ? recent : items.slice(0, 15);
  }

  private locate(text: string): KnownPlace | null {
    const normalized = this.normalize(text);
    for (const place of KNOWN_PLACES) {
      if (place.keywords.some((keyword) => normalized.includes(keyword))) {
        return place;
      }
    }
    return null;
  }

  private categorize(text: string): MapNewsCategory {
    const normalized = this.normalize(text);
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        return rule.category;
      }
    }
    return 'noticia';
  }

  private stableId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) {
      hash = (hash * 31 + url.charCodeAt(i)) | 0;
    }
    return `news_${(hash >>> 0).toString(16)}`;
  }

  private normalize(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  private asText(value: unknown): string | undefined {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number') return String(value);
    if (this.isRecord(value) && typeof value['#text'] === 'string') {
      return value['#text'].trim() || undefined;
    }
    return undefined;
  }

  private toIsoDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private cleanDescription(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const text = value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
