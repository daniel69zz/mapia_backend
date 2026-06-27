/**
 * Taxonomía de avisos de MAPIA: categorías, presentación (icono/color/riesgo)
 * y el ESQUEMA de campos recomendados por categoría para el Paso 2 (confirmar).
 *
 * Es data-driven a propósito: agregar/ajustar categorías o campos se hace aquí,
 * sin tocar el frontend (que pinta el formulario desde `fields`).
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'bool';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  /** Solo bloquea publicar si es true (campos esenciales). */
  required?: boolean;
  hint?: string;
  options?: string[]; // para type 'select'
}

export type RiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface CategorySpec {
  code: string;
  label: string;
  group: string;
  icon: string; // nombre de icono Material (lo mapea el frontend)
  color: string; // hex
  risk: RiskLevel;
  /** Palabras clave para el clasificador determinista (sin acentos, minúsculas). */
  keywords: string[];
  /** Campos recomendados específicos de la categoría (sin contar los comunes). */
  fields: FieldSpec[];
}

// --- Esquemas de campos reutilizables por grupo --------------------------------

/** Departamentos de Bolivia (opciones del combo de "Departamento"). */
export const DEPARTMENTS = [
  'La Paz',
  'Cochabamba',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Chuquisaca',
  'Tarija',
  'Beni',
  'Pando',
];

/** Campos de ubicación comunes a todas las categorías (combos con sugerencias IA). */
export const LOCATION_FIELDS: FieldSpec[] = [
  { key: 'department', label: 'Departamento', type: 'select', options: DEPARTMENTS },
  { key: 'municipality', label: 'Municipio', type: 'text', hint: 'Detectado por tu ubicación' },
  { key: 'zone', label: 'Zona', type: 'text', hint: 'Barrio o zona detectada por tu ubicación' },
];

const EVENT_FIELDS: FieldSpec[] = [
  { key: 'eventName', label: 'Nombre del evento', type: 'text', hint: 'Ej. Entrada del Gran Poder' },
  { key: 'date', label: 'Fecha', type: 'date' },
  { key: 'startTime', label: 'Hora de inicio', type: 'time' },
  { key: 'endTime', label: 'Hora de fin', type: 'time' },
  { key: 'price', label: 'Precio de entrada (Bs)', type: 'number', hint: '0 si es gratis' },
  { key: 'ticketContact', label: 'Contacto para entradas', type: 'text', hint: 'WhatsApp, teléfono o lugar' },
  { key: 'organizer', label: 'Organizador', type: 'text' },
];

const DEAL_FIELDS: FieldSpec[] = [
  { key: 'placeName', label: 'Nombre del lugar', type: 'text' },
  { key: 'productOrService', label: 'Producto o servicio', type: 'text' },
  { key: 'oldPrice', label: 'Precio anterior (Bs)', type: 'number' },
  { key: 'newPrice', label: 'Precio actual (Bs)', type: 'number' },
  { key: 'validUntil', label: 'Vigencia', type: 'text', hint: 'Hasta cuándo dura' },
  { key: 'contact', label: 'Contacto', type: 'text' },
];

const BLOCKADE_FIELDS: FieldSpec[] = [
  {
    key: 'affectationType',
    label: 'Tipo de afectación',
    type: 'select',
    options: ['parcial', 'total'],
  },
  { key: 'dangerLevel', label: 'Nivel de peligro', type: 'select', options: ['bajo', 'medio', 'alto'] },
  { key: 'affectedStreets', label: 'Calles o rutas afectadas', type: 'text' },
  { key: 'approxTime', label: 'Hora aproximada', type: 'time' },
  { key: 'reason', label: 'Motivo (si se conoce)', type: 'text' },
  { key: 'recommendation', label: 'Recomendación para evitar la zona', type: 'textarea' },
];

const EMERGENCY_FIELDS: FieldSpec[] = [
  { key: 'dangerLevel', label: 'Nivel de peligro', type: 'select', options: ['bajo', 'medio', 'alto', 'crítico'], required: true },
  { key: 'urgency', label: 'Urgencia', type: 'select', options: ['baja', 'media', 'alta'] },
  { key: 'peopleAffected', label: '¿Hay personas afectadas?', type: 'bool' },
  { key: 'riskDescription', label: 'Descripción del riesgo', type: 'textarea' },
  { key: 'exactLocation', label: 'Ubicación exacta', type: 'text' },
  { key: 'recommendation', label: 'Recomendación de acción', type: 'textarea' },
];

const SUPPLY_FIELDS: FieldSpec[] = [
  { key: 'product', label: 'Producto afectado', type: 'text' },
  { key: 'availability', label: 'Disponibilidad', type: 'select', options: ['hay', 'poco', 'no hay'] },
  { key: 'price', label: 'Precio (Bs)', type: 'number' },
  { key: 'scarcityLevel', label: 'Nivel de escasez', type: 'select', options: ['bajo', 'medio', 'alto'] },
  { key: 'establishment', label: 'Establecimiento', type: 'text' },
  { key: 'reportTime', label: 'Hora del reporte', type: 'time' },
];

const TRANSPORT_FIELDS: FieldSpec[] = [
  { key: 'route', label: 'Línea o ruta', type: 'text' },
  { key: 'affectationType', label: 'Tipo de afectación', type: 'select', options: ['parcial', 'total'] },
  { key: 'approxTime', label: 'Hora aproximada', type: 'time' },
  { key: 'recommendation', label: 'Recomendación', type: 'textarea' },
];

const SERVICE_FIELDS: FieldSpec[] = [
  { key: 'serviceType', label: 'Tipo de servicio', type: 'select', options: ['agua', 'luz', 'gas', 'internet', 'otro'] },
  { key: 'affectation', label: 'Afectación', type: 'text' },
  { key: 'estimatedRestore', label: 'Restablecimiento estimado', type: 'text' },
  { key: 'recommendation', label: 'Recomendación', type: 'textarea' },
];

// --- Catálogo de categorías ----------------------------------------------------

export const CATEGORIES: CategorySpec[] = [
  // Eventos / cultura / deporte
  { code: 'fiesta', label: 'Fiesta', group: 'evento', icon: 'celebration', color: '#A855F7', risk: 'info', keywords: ['fiesta', 'kermes', 'jolgorio'], fields: EVENT_FIELDS },
  { code: 'celebracion', label: 'Celebración', group: 'evento', icon: 'celebration', color: '#A855F7', risk: 'info', keywords: ['celebracion', 'aniversario', 'cumpleanos'], fields: EVENT_FIELDS },
  { code: 'evento_comunitario', label: 'Evento comunitario', group: 'evento', icon: 'groups', color: '#8B5CF6', risk: 'info', keywords: ['evento', 'comunitario', 'vecinal', 'junta'], fields: EVENT_FIELDS },
  { code: 'concierto_libre', label: 'Concierto libre', group: 'evento', icon: 'music_note', color: '#EC4899', risk: 'info', keywords: ['concierto', 'tocada', 'banda', 'dj', 'show'], fields: EVENT_FIELDS },
  { code: 'feria', label: 'Feria', group: 'evento', icon: 'storefront', color: '#F59E0B', risk: 'info', keywords: ['feria', 'expo', 'exposicion'], fields: EVENT_FIELDS },
  { code: 'entrada_folklorica', label: 'Entrada folklórica', group: 'evento', icon: 'festival', color: '#D946EF', risk: 'low', keywords: ['entrada', 'folklorica', 'folclorica', 'morenada', 'caporales', 'tinku'], fields: EVENT_FIELDS },
  { code: 'cultura', label: 'Cultura', group: 'evento', icon: 'theater_comedy', color: '#6366F1', risk: 'info', keywords: ['cultura', 'teatro', 'museo', 'arte', 'exposicion'], fields: EVENT_FIELDS },
  { code: 'deporte', label: 'Deporte', group: 'evento', icon: 'sports_soccer', color: '#10B981', risk: 'info', keywords: ['deporte', 'partido', 'campeonato', 'carrera', 'maraton'], fields: EVENT_FIELDS },

  // Comercio
  { code: 'descuento', label: 'Descuento', group: 'comercio', icon: 'sell', color: '#22C55E', risk: 'info', keywords: ['descuento', 'rebaja', 'oferta'], fields: DEAL_FIELDS },
  { code: 'promocion', label: 'Promoción', group: 'comercio', icon: 'local_offer', color: '#16A34A', risk: 'info', keywords: ['promocion', 'promo', '2x1', 'liquidacion'], fields: DEAL_FIELDS },

  // Conflicto / movilidad
  { code: 'bloqueo', label: 'Bloqueo', group: 'conflicto', icon: 'block', color: '#F97316', risk: 'high', keywords: ['bloqueo', 'bloqueado', 'cerrada', 'piedras', 'avasalla'], fields: BLOCKADE_FIELDS },
  { code: 'marcha', label: 'Marcha', group: 'conflicto', icon: 'campaign', color: '#FB923C', risk: 'medium', keywords: ['marcha', 'protesta', 'manifestacion', 'paro', 'huelga'], fields: BLOCKADE_FIELDS },
  { code: 'transporte', label: 'Transporte', group: 'movilidad', icon: 'directions_bus', color: '#0EA5E9', risk: 'medium', keywords: ['transporte', 'minibus', 'micro', 'trufi', 'teleferico', 'pumakatari'], fields: TRANSPORT_FIELDS },

  // Emergencias / seguridad / salud
  { code: 'incendio', label: 'Incendio', group: 'emergencia', icon: 'local_fire_department', color: '#EF4444', risk: 'critical', keywords: ['incendio', 'fuego', 'quema', 'humo'], fields: EMERGENCY_FIELDS },
  { code: 'accidente', label: 'Accidente', group: 'emergencia', icon: 'car_crash', color: '#DC2626', risk: 'high', keywords: ['accidente', 'choque', 'volcadura', 'atropello'], fields: EMERGENCY_FIELDS },
  { code: 'emergencia', label: 'Emergencia', group: 'emergencia', icon: 'emergency', color: '#B91C1C', risk: 'critical', keywords: ['emergencia', 'auxilio', 'rescate', 'desastre', 'riada', 'inundacion', 'derrumbe'], fields: EMERGENCY_FIELDS },
  { code: 'seguridad', label: 'Seguridad', group: 'emergencia', icon: 'local_police', color: '#7C3AED', risk: 'high', keywords: ['seguridad', 'robo', 'atraco', 'asalto', 'delincuencia', 'antisocial'], fields: EMERGENCY_FIELDS },
  { code: 'salud', label: 'Salud', group: 'emergencia', icon: 'health_and_safety', color: '#0891B2', risk: 'medium', keywords: ['salud', 'hospital', 'enfermedad', 'epidemia', 'dengue', 'ambulancia'], fields: EMERGENCY_FIELDS },

  // Abastecimiento
  { code: 'abastecimiento', label: 'Abastecimiento', group: 'abastecimiento', icon: 'inventory_2', color: '#CA8A04', risk: 'medium', keywords: ['abastecimiento', 'desabastecimiento', 'no hay', 'agotado', 'escasez', 'falta', 'sobreprecio'], fields: SUPPLY_FIELDS },
  { code: 'combustible', label: 'Combustible', group: 'abastecimiento', icon: 'local_gas_station', color: '#EA580C', risk: 'high', keywords: ['combustible', 'gasolina', 'diesel', 'gnv', 'surtidor', 'gasolinera'], fields: SUPPLY_FIELDS },

  // Servicios públicos
  { code: 'servicio_publico', label: 'Servicio público', group: 'servicio', icon: 'water_drop', color: '#0284C7', risk: 'medium', keywords: ['corte de agua', 'corte de luz', 'sin agua', 'sin luz', 'apagon', 'alcantarilla', 'basura', 'alumbrado', 'bache'], fields: SERVICE_FIELDS },

  // Fallback
  { code: 'otro', label: 'Otro', group: 'otro', icon: 'place', color: '#64748B', risk: 'info', keywords: [], fields: [] },
];

const BY_CODE = new Map(CATEGORIES.map((c) => [c.code, c]));

export function getCategory(code: string | null | undefined): CategorySpec {
  return (code && BY_CODE.get(code)) || BY_CODE.get('otro')!;
}

export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

/** Clasificador determinista por palabras clave (fallback sin IA). */
export function classifyByKeywords(text: string): CategorySpec {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  let best: { spec: CategorySpec; score: number } | null = null;
  for (const spec of CATEGORIES) {
    let score = 0;
    for (const kw of spec.keywords) {
      if (t.includes(kw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { spec, score };
    }
  }
  return best?.spec ?? getCategory('otro');
}
