import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiConfig } from '@core/config/configuration';
import { MapService } from '@modules/map/map.service';
import { MapAlertsQueryDto } from '@modules/map/dto/map-alerts-query.dto';
import { AlertType, ReportSeverity } from '@modules/reports/entities/alert-report.entity';
import { AskDto } from './dto/ask.dto';

/** Incidencia tal como la devuelve MapService.alerts() (lista para el frontend). */
interface IncidentItem {
  id: string;
  title: string;
  alertType: AlertType | null;
  severity: ReportSeverity | null;
  department: string | null;
  municipality: string | null;
  zone: string | null;
  lastReportedAt: string;
  [key: string]: unknown;
}

export interface ChatbotAnswer {
  reply: string;
  incidents: IncidentItem[];
  usedAi: boolean;
}

const MAX_INCIDENTS = 8;
const NEARBY_RADIUS_KM = 5;

const ALERT_TYPE_KEYWORDS: { type: AlertType; keywords: string[] }[] = [
  { type: 'bloqueo', keywords: ['bloqueo', 'bloqueos', 'marcha', 'paro', 'protesta', 'cerrada'] },
  { type: 'combustible', keywords: ['combustible', 'gasolina', 'diesel', 'diésel', 'gnv', 'surtidor', 'carburante'] },
  { type: 'sobreprecio', keywords: ['sobreprecio', 'precio', 'caro', 'subio', 'subió', 'especulacion', 'especulación'] },
  { type: 'stock_bajo', keywords: ['stock bajo', 'poco stock', 'casi no hay', 'queda poco'] },
  { type: 'producto_no_disponible', keywords: ['no hay', 'agotado', 'sin stock', 'desabastecimiento', 'falta de'] },
];

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  stock_bajo: 'stock bajo',
  sobreprecio: 'sobreprecio',
  bloqueo: 'bloqueo',
  retraso_proveedor: 'retraso de proveedor',
  combustible: 'combustible',
  producto_no_disponible: 'producto no disponible',
  otro: 'otro',
};

const SEVERITY_LABELS: Record<ReportSeverity, string> = {
  normal: 'normal',
  low: 'riesgo bajo',
  medium: 'riesgo medio',
  high: 'alerta alta',
};

/** Lugares conocidos → filtro por departamento o municipio. */
const PLACES: { keywords: string[]; department?: string; municipality?: string }[] = [
  { keywords: ['el alto'], municipality: 'El Alto' },
  { keywords: ['la paz'], department: 'La Paz' },
  { keywords: ['santa cruz'], department: 'Santa Cruz' },
  { keywords: ['cochabamba'], department: 'Cochabamba' },
  { keywords: ['oruro'], department: 'Oruro' },
  { keywords: ['potosi', 'potosí'], department: 'Potosí' },
  { keywords: ['sucre', 'chuquisaca'], department: 'Chuquisaca' },
  { keywords: ['tarija'], department: 'Tarija' },
  { keywords: ['beni', 'trinidad'], department: 'Beni' },
  { keywords: ['pando', 'cobija'], department: 'Pando' },
];

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly ai: AiConfig;
  private genai: GoogleGenAI | null = null;

  constructor(
    private readonly mapService: MapService,
    configService: ConfigService,
  ) {
    this.ai = configService.get<AiConfig>('ai')!;
  }

  async ask(dto: AskDto): Promise<ChatbotAnswer> {
    const query = this.buildQuery(dto);
    const { items } = await this.mapService.alerts(query);
    const incidents = (items as IncidentItem[]).slice(0, MAX_INCIDENTS);

    const deterministic = this.composeDeterministic(incidents, query);

    if (!this.ai.enabled) {
      return { reply: deterministic, incidents, usedAi: false };
    }

    try {
      const reply = await this.composeWithAi(dto.message, incidents);
      return { reply: reply || deterministic, incidents, usedAi: true };
    } catch (error) {
      this.logger.warn(`IA no disponible, uso respuesta determinista: ${this.errMsg(error)}`);
      return { reply: deterministic, incidents, usedAi: false };
    }
  }

  /** Transcribe audio a texto con la API de OpenAI (Whisper). */
  async transcribe(file?: Express.Multer.File): Promise<{ text: string }> {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Audio requerido');
    }
    const apiKey = this.ai.openaiApiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada en el servidor',
      );
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'audio/m4a',
    });
    form.append('file', blob, file.originalname || 'audio.m4a');
    form.append('model', this.ai.whisperModel);
    form.append('language', 'es');
    form.append(
      'prompt',
      'Transcripción en español de Bolivia para la app MAPIA. Vocabulario probable: ' +
        'La Paz, El Alto, Sopocachi, Miraflores, Santa Cruz, Cochabamba, bloqueo, ' +
        'corte de servicio, avasallamiento, sobreprecio, combustible, incidencia.',
    );

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      this.logger.error(`OpenAI transcripción, error de red: ${this.errMsg(error)}`);
      throw new BadGatewayException('No se pudo contactar al servicio de transcripción');
    }

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`OpenAI transcripción ${response.status}: ${detail}`);
      throw new BadGatewayException('El servicio de transcripción devolvió un error');
    }

    const json = (await response.json()) as { text?: string };
    return { text: (json.text ?? '').trim() };
  }

  /** Traduce el mensaje libre del usuario a filtros de incidencias. */
  private buildQuery(dto: AskDto): MapAlertsQueryDto {
    const text = this.normalize(dto.message);
    const query: MapAlertsQueryDto = {};

    for (const rule of ALERT_TYPE_KEYWORDS) {
      if (rule.keywords.some((k) => text.includes(this.normalize(k)))) {
        query.alertType = rule.type;
        break;
      }
    }

    if (['grave', 'urgente', 'alta', 'critico', 'crítico', 'peligro'].some((k) => text.includes(k))) {
      query.severity = 'high';
    }

    for (const place of PLACES) {
      if (place.keywords.some((k) => text.includes(this.normalize(k)))) {
        if (place.municipality) query.municipality = place.municipality;
        if (place.department) query.department = place.department;
        break;
      }
    }

    const wantsNear = ['cerca', 'cercan', 'aqui', 'aquí', 'por aca', 'por acá', 'mi ubicacion', 'mi ubicación'].some(
      (k) => text.includes(k),
    );
    if (wantsNear && dto.lat !== undefined && dto.lng !== undefined) {
      query.lat = dto.lat;
      query.lng = dto.lng;
      query.radiusKm = NEARBY_RADIUS_KM;
    }

    return query;
  }

  /** Respuesta garantizada (sin IA) a partir de las incidencias recuperadas. */
  private composeDeterministic(incidents: IncidentItem[], query: MapAlertsQueryDto): string {
    const filterText = this.describeFilters(query);

    if (incidents.length === 0) {
      return `No encontré incidencias registradas${filterText}. Prueba ampliando la búsqueda o consulta el mapa.`;
    }

    const lines = incidents.map((it, i) => {
      const sev = it.severity ? SEVERITY_LABELS[it.severity] : 'sin severidad';
      const place = it.zone || it.municipality || it.department || 'ubicación no especificada';
      return `${i + 1}. ${it.title} · ${sev} · ${place} · ${this.timeAgo(it.lastReportedAt)}`;
    });

    const count = incidents.length;
    const header = `Encontré ${count} incidencia${count === 1 ? '' : 's'} registrada${count === 1 ? '' : 's'}${filterText}:`;
    return `${header}\n${lines.join('\n')}`;
  }

  /** Redacta la respuesta con Gemini usando SOLO las incidencias recuperadas (RAG). */
  private async composeWithAi(message: string, incidents: IncidentItem[]): Promise<string> {
    const client = this.getClient();
    const compact = incidents.map((it) => ({
      titulo: it.title,
      tipo: it.alertType ? ALERT_TYPE_LABELS[it.alertType] : null,
      severidad: it.severity ? SEVERITY_LABELS[it.severity] : null,
      lugar: it.zone || it.municipality || it.department || null,
      fecha: it.lastReportedAt,
    }));

    const system = [
      'Eres el Asistente de MAPIA, un mapa social ciudadano de Bolivia.',
      'Respondes en español, breve, claro y útil.',
      'Responde ÚNICAMENTE con base en las incidencias proporcionadas en JSON. NO inventes datos.',
      'Si la lista está vacía, dilo con honestidad y sugiere ampliar la búsqueda.',
      'Resume cuántas hay y las más relevantes (tipo, severidad, lugar). No uses markdown.',
    ].join(' ');

    const user = `Pregunta del usuario: "${message}"\n\nIncidencias registradas (JSON):\n${JSON.stringify(compact)}`;

    const response = await client.models.generateContent({
      model: this.ai.model,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      config: { systemInstruction: system, temperature: 0.3 },
    });

    return (response.text ?? '').trim();
  }

  private getClient(): GoogleGenAI {
    if (!this.genai) {
      this.genai = this.ai.useVertex
        ? new GoogleGenAI({ vertexai: true, project: this.ai.project, location: this.ai.location })
        : new GoogleGenAI({ apiKey: this.ai.apiKey });
    }
    return this.genai;
  }

  private describeFilters(query: MapAlertsQueryDto): string {
    const parts: string[] = [];
    if (query.alertType) parts.push(`de tipo "${ALERT_TYPE_LABELS[query.alertType]}"`);
    if (query.severity === 'high') parts.push('de alerta alta');
    if (query.municipality) parts.push(`en ${query.municipality}`);
    else if (query.department) parts.push(`en ${query.department}`);
    if (query.lat !== undefined) parts.push('cerca de ti');
    return parts.length ? ` ${parts.join(' ')}` : '';
  }

  private timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return 'fecha desconocida';
    const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
    if (mins < 1) return 'hace instantes';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
