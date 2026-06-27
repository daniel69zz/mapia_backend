import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { AiConfig } from '@core/config/configuration';
import {
  AiImageAnalysis,
  AnalyzeImageInput,
  IImageAnalyzer,
  REPORT_CATEGORIES,
  ReportCategory,
} from './ai.types';
import { CITIZEN_REPORT_SYSTEM, CITIZEN_REPORT_USER } from './prompts/citizen-report.prompt';

/**
 * Analizador de imágenes con Gemini multimodal vía Vertex AI.
 *
 * - Autenticación por ADC (Application Default Credentials):
 *   local -> `gcloud auth application-default login`
 *   Cloud Run -> service account adjunta (rol roles/aiplatform.user).
 * - El cliente se construye de forma perezosa para no romper el arranque si la IA
 *   está deshabilitada o sin credenciales.
 * - `responseSchema` fuerza JSON válido y acota la categoría al enum permitido.
 */
@Injectable()
export class VertexGeminiService implements IImageAnalyzer {
  private readonly logger = new Logger(VertexGeminiService.name);
  private readonly config: AiConfig;
  private client: GoogleGenAI | null = null;

  constructor(configService: ConfigService) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  private getClient(): GoogleGenAI {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException(
        'El análisis por IA está deshabilitado (AI_VISION_ENABLED=false).',
      );
    }
    if (this.config.useVertex && !this.config.project) {
      throw new ServiceUnavailableException('Falta GOOGLE_CLOUD_PROJECT para usar Vertex AI.');
    }
    if (!this.client) {
      this.client = this.config.useVertex
        ? new GoogleGenAI({
            vertexai: true,
            project: this.config.project,
            location: this.config.location,
          })
        : new GoogleGenAI({ apiKey: this.config.apiKey });
    }
    return this.client;
  }

  async analyzeImage({ buffer, mimeType }: AnalyzeImageInput): Promise<AiImageAnalysis> {
    const client = this.getClient();
    const started = Date.now();

    let response;
    try {
      response = await client.models.generateContent({
        model: this.config.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: CITIZEN_REPORT_USER },
              { inlineData: { mimeType, data: buffer.toString('base64') } },
            ],
          },
        ],
        config: {
          systemInstruction: CITIZEN_REPORT_SYSTEM,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['category', 'title', 'description', 'confidence', 'tags', 'requires_review'],
            properties: {
              category: { type: Type.STRING, enum: REPORT_CATEGORIES as string[] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              requires_review: { type: Type.BOOLEAN },
              detected_text: { type: Type.STRING, nullable: true },
              safety_notes: { type: Type.STRING, nullable: true },
            },
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Vertex AI generateContent falló: ${message}`);
      throw new BadGatewayException('No se pudo analizar la imagen con el modelo de IA.');
    }

    const latencyMs = Date.now() - started;
    const parsed = this.normalize(response.text ?? '{}');

    return {
      ...parsed,
      raw: response,
      model: this.config.model,
      provider: this.config.useVertex ? 'vertex' : 'gemini-aistudio',
      latencyMs,
    };
  }

  /** Tolerante a basura alrededor del JSON; valida y acota cada campo. */
  private normalize(
    text: string,
  ): Omit<AiImageAnalysis, 'raw' | 'model' | 'provider' | 'latencyMs'> {
    let obj: Record<string, unknown>;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      obj = JSON.parse(start >= 0 ? clean.slice(start, end + 1) : clean);
    } catch {
      this.logger.warn('El modelo devolvió un JSON inválido; se marca para revisión.');
      return {
        category: 'otro',
        title: 'Reporte sin clasificar',
        description: '',
        confidence: 0,
        tags: [],
        requiresReview: true,
        detectedText: null,
        safetyNotes: 'JSON inválido del modelo',
      };
    }

    const category: ReportCategory = REPORT_CATEGORIES.includes(obj.category as ReportCategory)
      ? (obj.category as ReportCategory)
      : 'otro';
    const confidence = clamp01(Number(obj.confidence));
    const reviewThreshold = this.config.reviewThreshold;

    return {
      category,
      title: String(obj.title ?? 'Reporte ciudadano').slice(0, 120),
      description: String(obj.description ?? '').slice(0, 1000),
      confidence,
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 10) : [],
      requiresReview:
        Boolean(obj.requires_review) || category === 'otro' || confidence < reviewThreshold,
      detectedText: obj.detected_text ? String(obj.detected_text) : null,
      safetyNotes: obj.safety_notes ? String(obj.safety_notes) : null,
    };
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
