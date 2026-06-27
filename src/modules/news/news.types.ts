/** Categorías de noticias geolocalizadas que entiende el mapa del frontend. */
export type MapNewsCategory =
  | 'evento'
  | 'bloqueo'
  | 'corte_servicio'
  | 'venta'
  | 'noticia';

/**
 * Noticia lista para pintarse como marcador en el mapa.
 * El shape (camelCase + lat/lng) coincide con `MapNewsItem.fromJson` del frontend.
 */
export interface MapNewsItem {
  id: string;
  title: string;
  description: string | null;
  source: string;
  url: string;
  publishedAt: string; // ISO 8601
  locationText: string | null;
  lat: number;
  lng: number;
  category: MapNewsCategory;
  createdBy: string;
  locationStatus: string;
}
