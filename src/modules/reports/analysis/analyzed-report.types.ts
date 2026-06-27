import { FieldType, RiskLevel } from './report-taxonomy';

/** Un campo del formulario dinámico del Paso 2. */
export interface AnalyzedField {
  key: string;
  label: string;
  type: FieldType;
  value: string | null;
  required: boolean;
  /** 'ai' = lo infirió la IA/heurística; 'empty' = sugerido para completar. */
  source: 'ai' | 'empty';
  hint?: string;
  options?: string[];
  /** Sugerencias (de IA o catálogo) para mostrar el campo como combo editable. */
  suggestions: string[];
}

/** Resultado del Paso 1: aviso clasificado y listo para confirmar. */
export interface AnalyzedReport {
  category: string;
  categoryLabel: string;
  group: string;
  title: string;
  description: string;
  summary: string; // resumen corto para el mapa
  icon: string;
  color: string;
  riskLevel: RiskLevel;
  confidence: number; // 0..1
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  fields: AnalyzedField[];
  usedAi: boolean;
}
