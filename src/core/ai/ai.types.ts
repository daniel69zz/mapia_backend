/** Categorías de reporte ciudadano analizado por IA (imagen). */
export type ReportCategory =
  | 'bloqueo'
  | 'corte_servicio'
  | 'fiesta_evento'
  | 'venta'
  | 'problema_vial'
  | 'atractivo_turistico'
  | 'restaurante'
  | 'otro';

export const REPORT_CATEGORIES: ReportCategory[] = [
  'bloqueo',
  'corte_servicio',
  'fiesta_evento',
  'venta',
  'problema_vial',
  'atractivo_turistico',
  'restaurante',
  'otro',
];

/** Token de inyección del analizador de imágenes (provider-agnóstico). */
export const IMAGE_ANALYZER = Symbol('IMAGE_ANALYZER');

export interface AnalyzeImageInput {
  buffer: Buffer;
  mimeType: string;
}

/** Resultado normalizado del análisis de una imagen por el modelo. */
export interface AiImageAnalysis {
  category: ReportCategory;
  title: string;
  description: string;
  confidence: number; // 0..1
  tags: string[];
  requiresReview: boolean;
  detectedText: string | null;
  safetyNotes: string | null;
  raw: unknown; // respuesta cruda del modelo (auditoría)
  model: string;
  provider: string;
  latencyMs: number;
}

export interface IImageAnalyzer {
  analyzeImage(input: AnalyzeImageInput): Promise<AiImageAnalysis>;
}
