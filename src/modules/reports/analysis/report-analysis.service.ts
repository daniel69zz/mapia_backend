import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiConfig } from '@core/config/configuration';
import { AnalyzeReportDto } from '../dto/analyze-report.dto';
import { AnalyzedField, AnalyzedReport } from './analyzed-report.types';
import {
  CATEGORIES,
  CATEGORY_CODES,
  CategorySpec,
  RiskLevel,
  classifyByKeywords,
  getCategory,
} from './report-taxonomy';

const RISK_LEVELS: RiskLevel[] = ['info', 'low', 'medium', 'high', 'critical'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AI_IMAGES = 2;

/** Diccionario único key→label de TODOS los campos (para guiar a la IA). */
const ALL_FIELDS: { key: string; label: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const cat of CATEGORIES) {
    for (const f of cat.fields) {
      if (!seen.has(f.key)) seen.set(f.key, f.label);
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
})();

interface AiResult {
  category?: string;
  title?: string;
  description?: string;
  summary?: string;
  riskLevel?: string;
  values?: Record<string, unknown>;
}

@Injectable()
export class ReportAnalysisService {
  private readonly logger = new Logger(ReportAnalysisService.name);
  private readonly ai: AiConfig;
  private genai: GoogleGenAI | null = null;

  constructor(configService: ConfigService) {
    this.ai = configService.get<AiConfig>('ai')!;
  }

  async analyze(
    dto: AnalyzeReportDto,
    images: Express.Multer.File[],
  ): Promise<AnalyzedReport> {
    const text = dto.text.trim();
    const heuristicValues = this.extractHeuristics(text);
    const zone =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? departmentFromCoords(dto.latitude, dto.longitude)
        : null;

    let ai: AiResult | null = null;
    if (this.ai.enabled) {
      try {
        ai = await this.classifyWithAi(text, images);
      } catch (error) {
        this.logger.warn(`IA no disponible, uso heurística: ${this.errMsg(error)}`);
      }
    }

    const category: CategorySpec =
      ai?.category && CATEGORY_CODES.includes(ai.category)
        ? getCategory(ai.category)
        : classifyByKeywords(text);

    const aiValues = (ai?.values ?? {}) as Record<string, unknown>;

    const fields: AnalyzedField[] = category.fields.map((spec) => {
      const raw = aiValues[spec.key] ?? heuristicValues[spec.key] ?? null;
      const value = raw === null || raw === undefined ? null : String(raw).trim();
      // 'zone' se completa con la ubicación del mapa si no vino otra cosa.
      const finalValue =
        value && value.length > 0 ? value : spec.key === 'zone' ? zone : null;
      return {
        key: spec.key,
        label: spec.label,
        type: spec.type,
        value: finalValue && finalValue.length > 0 ? finalValue : null,
        required: spec.required ?? false,
        source: finalValue && finalValue.length > 0 ? 'ai' : 'empty',
        hint: spec.hint,
        options: spec.options,
      };
    });

    const riskLevel: RiskLevel =
      ai?.riskLevel && RISK_LEVELS.includes(ai.riskLevel as RiskLevel)
        ? (ai.riskLevel as RiskLevel)
        : category.risk;

    const title = clean(ai?.title) || this.fallbackTitle(text, category);
    const description = clean(ai?.description) || text;
    const summary = clean(ai?.summary)?.slice(0, 110) || description.slice(0, 110);

    return {
      category: category.code,
      categoryLabel: category.label,
      group: category.group,
      title,
      description,
      summary,
      icon: category.icon,
      color: category.color,
      riskLevel,
      confidence: ai ? 0.85 : 0.55,
      zone,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      fields,
      usedAi: ai !== null,
    };
  }

  // --- IA -----------------------------------------------------------------------

  private async classifyWithAi(
    text: string,
    images: Express.Multer.File[],
  ): Promise<AiResult> {
    const client = this.getClient();

    const categoryList = CATEGORIES.map((c) => `${c.code} (${c.label})`).join(', ');
    const fieldList = ALL_FIELDS.map((f) => `${f.key} = ${f.label}`).join('; ');

    const system = [
      'Eres el clasificador de avisos ciudadanos de MAPIA (Bolivia).',
      'Analiza el texto, las imágenes y el contexto. PRIMERO clasifica en EXACTAMENTE una categoría;',
      'luego extrae toda la información útil que encuentres. Responde SOLO JSON válido, sin markdown.',
      'No inventes datos que no estén en el texto o imágenes; si no sabes un campo, omítelo.',
      `Categorías permitidas (usa el code exacto): ${categoryList}.`,
      `En "values" usa solo estas claves cuando apliquen: ${fieldList}.`,
      'Estructura: {"category": code, "title": string corto, "description": string mejorado, ' +
        '"summary": string <=90 chars para el mapa, "riskLevel": "info|low|medium|high|critical", ' +
        '"values": { clave: valor_string }}',
    ].join(' ');

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: `Texto del usuario: "${text}"` },
    ];
    for (const img of images.slice(0, MAX_AI_IMAGES)) {
      const mimeType = resolveImageMime(img);
      if (mimeType) {
        parts.push({
          inlineData: { mimeType, data: img.buffer.toString('base64') },
        });
      }
    }

    const response = await client.models.generateContent({
      model: this.ai.model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: system,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    return this.parseJson(response.text ?? '');
  }

  private parseJson(text: string): AiResult {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      return JSON.parse(start >= 0 ? clean.slice(start, end + 1) : clean) as AiResult;
    } catch {
      return {};
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.genai) {
      this.genai = this.ai.useVertex
        ? new GoogleGenAI({ vertexai: true, project: this.ai.project, location: this.ai.location })
        : new GoogleGenAI({ apiKey: this.ai.apiKey });
    }
    return this.genai;
  }

  // --- Heurística (sin IA) ------------------------------------------------------

  private extractHeuristics(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    const price = text.match(/(?:bs\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:bs\.?|bolivianos?)/i);
    if (price) out.price = price[1].replace(',', '.');
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (time) out.approxTime = time[0];
    return out;
  }

  private fallbackTitle(text: string, category: CategorySpec): string {
    const firstSentence = text.split(/[.\n]/)[0].trim();
    const base = firstSentence.length > 4 ? firstSentence : category.label;
    return base.length <= 80 ? base : `${base.slice(0, 77)}...`;
  }

  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Devuelve un mimetype de imagen válido por mimetype o por extensión, o null. */
function resolveImageMime(file: Express.Multer.File): string | null {
  if (IMAGE_MIME.includes(file.mimetype)) return file.mimetype;
  const name = (file.originalname ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function departmentFromCoords(lat: number, lng: number): string {
  if (lat < -17.0 && lng > -64.5) return 'Santa Cruz';
  if (lat < -17.0 && lng <= -64.5 && lng > -67.8) return 'Cochabamba';
  if (lat < -18.3 && lng <= -67.8) return 'Oruro';
  if (lat > -15.5 && lng > -66.5) return 'Beni';
  if (lat > -15.0 && lng <= -66.5) return 'La Paz';
  if (lat < -19.0 && lng > -65.8) return 'Chuquisaca';
  if (lat < -20.0 && lng <= -65.8) return 'Potosí';
  return 'La Paz';
}
