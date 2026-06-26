/**
 * Convierte km a metros aplicando un tope de seguridad (maxRadiusKm).
 * Evita consultas PostGIS desproporcionadas.
 */
export function clampRadiusToMeters(
  radiusKm: number | undefined,
  defaultKm: number,
  maxKm: number,
): number {
  const km = radiusKm && radiusKm > 0 ? radiusKm : defaultKm;
  const clamped = Math.min(km, maxKm);
  return Math.round(clamped * 1000);
}

/** Valida un bounding box "minLng,minLat,maxLng,maxLat". */
export function parseBbox(bbox: string): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error('bbox inválido, formato esperado: minLng,minLat,maxLng,maxLat');
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  return { minLng, minLat, maxLng, maxLat };
}
