import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapsConfig } from '@core/config/configuration';
import { GeoPlaceDto } from './dto/locations-query.dto';

interface CacheEntry {
  value: GeoPlaceDto[];
  expiresAt: number;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h: el geocoding cambia poco y la API cuesta.

/**
 * Geocoding / búsqueda de lugares vía Google Maps.
 * - Cachea en memoria para no gastar de más (en prod podría ser Redis).
 * - Si no hay API key o está deshabilitado, responde MOCK (no rompe dev).
 */
@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly cfg: MapsConfig;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly configService: ConfigService) {
    this.cfg = this.configService.get<MapsConfig>('maps')!;
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeoPlaceDto> {
    const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = this.readCache(key);
    if (cached) return cached[0];

    if (!this.cfg.apiKey || !this.cfg.geocodingEnabled) {
      return this.mockReverse(lat, lng);
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', this.cfg.apiKey);
      url.searchParams.set('language', 'es');

      const res = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        results: { formatted_address: string }[];
      };
      const first = data.results?.[0];
      if (data.status !== 'OK' || !first) {
        return this.mockReverse(lat, lng);
      }
      const place: GeoPlaceDto = {
        formattedAddress: first.formatted_address,
        latitude: lat,
        longitude: lng,
        source: 'google',
      };
      this.writeCache(key, [place]);
      return place;
    } catch (err) {
      this.logger.warn(`Reverse geocode falló, usando mock: ${(err as Error).message}`);
      return this.mockReverse(lat, lng);
    }
  }

  async searchPlaces(q: string): Promise<GeoPlaceDto[]> {
    const key = `search:${q.toLowerCase()}`;
    const cached = this.readCache(key);
    if (cached) return cached;

    if (!this.cfg.apiKey || !this.cfg.placesEnabled) {
      return [this.mockSearch(q)];
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', q);
      url.searchParams.set('key', this.cfg.apiKey);
      url.searchParams.set('language', 'es');
      // Sesga resultados hacia Bolivia / La Paz.
      url.searchParams.set('region', 'bo');

      const res = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        results: {
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
        }[];
      };
      if (data.status !== 'OK' || !data.results?.length) {
        return [this.mockSearch(q)];
      }
      const places: GeoPlaceDto[] = data.results.slice(0, 10).map((r) => ({
        formattedAddress: r.formatted_address,
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        source: 'google',
      }));
      this.writeCache(key, places);
      return places;
    } catch (err) {
      this.logger.warn(`Places search falló, usando mock: ${(err as Error).message}`);
      return [this.mockSearch(q)];
    }
  }

  // --- mocks (desarrollo sin API key) ---

  private mockReverse(lat: number, lng: number): GeoPlaceDto {
    return {
      formattedAddress: `Ubicación aproximada (${lat.toFixed(4)}, ${lng.toFixed(4)}), La Paz, Bolivia`,
      latitude: lat,
      longitude: lng,
      source: 'mock',
    };
  }

  private mockSearch(q: string): GeoPlaceDto {
    // Centro aproximado de La Paz como referencia genérica.
    return {
      formattedAddress: `${q}, La Paz, Bolivia`,
      latitude: -16.5,
      longitude: -68.15,
      source: 'mock',
    };
  }

  // --- cache helpers ---

  private readCache(key: string): GeoPlaceDto[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeCache(key: string, value: GeoPlaceDto[]): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
