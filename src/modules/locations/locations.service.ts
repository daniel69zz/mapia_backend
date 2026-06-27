import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapsConfig } from '@core/config/configuration';
import { GeoPlaceDto } from './dto/locations-query.dto';

interface CacheEntry {
  value: GeoPlaceDto[];
  expiresAt: number;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

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
      throw new ServiceUnavailableException('Google Geocoding no está configurado.');
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
        throw new ServiceUnavailableException(
          'No se encontró una dirección real para esa ubicación.',
        );
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
      this.logger.warn(`Reverse geocode falló: ${(err as Error).message}`);
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException('No se pudo resolver la ubicación.');
    }
  }

  async searchPlaces(q: string): Promise<GeoPlaceDto[]> {
    const key = `search:${q.toLowerCase()}`;
    const cached = this.readCache(key);
    if (cached) return cached;

    if (!this.cfg.apiKey || !this.cfg.placesEnabled) {
      return [];
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', q);
      url.searchParams.set('key', this.cfg.apiKey);
      url.searchParams.set('language', 'es');
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
        return [];
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
      this.logger.warn(`Places search falló: ${(err as Error).message}`);
      return [];
    }
  }

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
