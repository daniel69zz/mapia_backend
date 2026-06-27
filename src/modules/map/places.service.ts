import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapsConfig } from '@core/config/configuration';

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

/**
 * Búsqueda de lugares y geocoding inverso vía Google Maps Platform.
 * La API key vive en el servidor (no se expone al cliente).
 */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly maps: MapsConfig;

  constructor(configService: ConfigService) {
    this.maps = configService.get<MapsConfig>('maps')!;
  }

  private requireKey(enabled: boolean, feature: string): string {
    if (!enabled || !this.maps.apiKey) {
      throw new ServiceUnavailableException(
        `${feature} no está disponible (revisa GOOGLE_MAPS_API_KEY y los flags).`,
      );
    }
    return this.maps.apiKey;
  }

  async autocomplete(query: string, lat?: number, lng?: number): Promise<PlaceSuggestion[]> {
    const key = this.requireKey(this.maps.placesEnabled, 'Búsqueda de lugares');
    if (query.trim().length < 2) return [];

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', query);
    url.searchParams.set('key', key);
    url.searchParams.set('language', 'es');
    url.searchParams.set('components', 'country:bo');
    if (lat !== undefined && lng !== undefined) {
      url.searchParams.set('location', `${lat},${lng}`);
      url.searchParams.set('radius', '50000');
    }

    const data = await this.getJson<AutocompleteResponse>(url.toString());
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Places autocomplete: ${data.status}`);
      return [];
    }
    return (data.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  }

  async details(placeId: string): Promise<PlaceDetails> {
    const key = this.requireKey(this.maps.placesEnabled, 'Detalle de lugar');
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', key);
    url.searchParams.set('language', 'es');
    url.searchParams.set('fields', 'geometry,name,formatted_address');

    const data = await this.getJson<DetailsResponse>(url.toString());
    const result = data.result;
    if (data.status !== 'OK' || !result?.geometry?.location) {
      throw new BadGatewayException('No se pudo obtener el detalle del lugar');
    }
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      name: result.name ?? '',
      address: result.formatted_address ?? result.name ?? '',
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<{ address: string }> {
    const key = this.requireKey(this.maps.geocodingEnabled, 'Geocoding inverso');
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', key);
    url.searchParams.set('language', 'es');

    const data = await this.getJson<GeocodeResponse>(url.toString());
    const address = data.results?.[0]?.formatted_address ?? '';
    return { address };
  }

  private async getJson<T>(url: string): Promise<T> {
    try {
      const res = await fetch(url);
      return (await res.json()) as T;
    } catch (error) {
      this.logger.error(
        `Google Maps API error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('No se pudo contactar a Google Maps');
    }
  }
}

interface AutocompleteResponse {
  status: string;
  predictions?: { place_id: string; description: string }[];
}
interface DetailsResponse {
  status: string;
  result?: {
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
}
interface GeocodeResponse {
  status: string;
  results?: { formatted_address?: string }[];
}
