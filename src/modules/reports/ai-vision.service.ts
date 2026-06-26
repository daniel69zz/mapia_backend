import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IStorageService, STORAGE_SERVICE } from '@core/storage/storage.types';
import { IImageAnalyzer, IMAGE_ANALYZER } from '@core/ai/ai.types';
import { AlertReport, ReportStatus } from './entities/alert-report.entity';
import { AlertReportImage } from './entities/alert-report-image.entity';
import { ReportAiAnalysis } from './entities/report-ai-analysis.entity';
import { ModerationService } from './moderation.service';
import { ConfirmReportDto } from './dto/confirm-report.dto';

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BOLIVIA_BOUNDS = { minLat: -22.9, maxLat: -9.6, minLng: -69.7, maxLng: -57.4 };

@Injectable()
export class AiVisionService {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    @Inject(IMAGE_ANALYZER) private readonly analyzer: IImageAnalyzer,
    @InjectRepository(AlertReport) private readonly reportRepo: Repository<AlertReport>,
    @InjectRepository(AlertReportImage) private readonly imageRepo: Repository<AlertReportImage>,
    @InjectRepository(ReportAiAnalysis) private readonly aiRepo: Repository<ReportAiAnalysis>,
    private readonly moderation: ModerationService,
  ) {}

  /**
   * Sube la imagen, la analiza con Gemini (Vertex AI) y crea el reporte en el
   * estado que dictan las reglas de confianza. Devuelve la sugerencia para que
   * el usuario confirme/edite.
   */
  async analyzePhoto(
    userId: string,
    file: Express.Multer.File | undefined,
    latitude: number,
    longitude: number,
  ) {
    if (!file) throw new BadRequestException('Debes adjuntar una imagen en el campo "image".');
    if (!IMAGE_MIME.includes(file.mimetype)) {
      throw new BadRequestException('La imagen debe ser JPG, PNG o WEBP.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('La imagen supera el tamaño máximo (5 MB).');
    }
    this.assertInsideBolivia(latitude, longitude);

    // 1) Analizar la imagen (buffer en memoria, no necesita estar en storage aún).
    const ai = await this.analyzer.analyzeImage({
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    // 2) Decidir estado por confianza.
    const decision = this.moderation.decide({
      confidence: ai.confidence,
      requiresReview: ai.requiresReview,
      category: ai.category,
    });
    const status = this.moderation.statusForDecision(decision);

    // 3) Persistir el reporte.
    const report = await this.reportRepo.save(
      this.reportRepo.create({
        userId,
        title: ai.title,
        description: ai.description || null,
        category: ai.category,
        tags: ai.tags,
        latitude,
        longitude,
        confidence: String(ai.confidence),
        status,
        sourceText: ai.detectedText,
      }),
    );

    // 4) Setear geography(Point,4326) por SQL (TypeORM no mapea geography directo).
    await this.setLocation(report.id, latitude, longitude);

    // 5) Guardar la imagen en storage + fila report_images.
    const stored = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: `reports/${report.id}`,
    });
    const image = await this.imageRepo.save(
      this.imageRepo.create({ reportId: report.id, url: stored.url, path: stored.storageKey }),
    );

    // 6) Guardar la respuesta cruda del modelo (auditoría).
    const analysis = await this.aiRepo.save(
      this.aiRepo.create({
        reportId: report.id,
        imageId: image.id,
        provider: ai.provider,
        model: ai.model,
        category: ai.category,
        title: ai.title,
        description: ai.description,
        confidence: String(ai.confidence),
        tags: ai.tags,
        requiresReview: ai.requiresReview,
        detectedText: ai.detectedText,
        safetyNotes: ai.safetyNotes,
        rawResponse: ai.raw,
        latencyMs: ai.latencyMs,
      }),
    );

    // 7) Log de moderación.
    await this.moderation.log({
      reportId: report.id,
      action: decision === 'auto_publish' ? 'auto_publish' : 'sent_to_review',
      toStatus: status,
      metadata: { confidence: ai.confidence, decision, provider: ai.provider },
    });

    return {
      reportId: report.id,
      status,
      decision,
      imageUrl: stored.url,
      analysis: {
        category: ai.category,
        title: ai.title,
        description: ai.description,
        confidence: ai.confidence,
        tags: ai.tags,
        requiresReview: ai.requiresReview,
        detectedText: ai.detectedText,
        safetyNotes: ai.safetyNotes,
      },
      aiAnalysisId: analysis.id,
    };
  }

  /** El usuario confirma/edita la sugerencia => publica. */
  async confirm(actor: { userId: string; role: string }, reportId: string, dto: ConfirmReportDto) {
    const report = await this.getOwnedOrFail(actor, reportId);
    const from = report.status;
    const edited =
      dto.category !== undefined ||
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.tags !== undefined;

    if (dto.category !== undefined) report.category = dto.category;
    if (dto.title !== undefined) report.title = dto.title;
    if (dto.description !== undefined) report.description = dto.description;
    if (dto.tags !== undefined) report.tags = dto.tags;
    report.status = 'published';
    await this.reportRepo.save(report);

    await this.moderation.log({
      reportId,
      actorId: actor.userId,
      action: edited ? 'edited' : 'approved',
      fromStatus: from,
      toStatus: 'published',
    });
    return { id: report.id, status: report.status };
  }

  /** El usuario cancela o un moderador descarta. */
  async reject(actor: { userId: string; role: string }, reportId: string, reason?: string) {
    const report = await this.getOwnedOrFail(actor, reportId);
    const from = report.status;
    report.status = 'rejected';
    await this.reportRepo.save(report);

    await this.moderation.log({
      reportId,
      actorId: actor.userId,
      action: 'rejected',
      fromStatus: from,
      toStatus: 'rejected',
      reason: reason ?? null,
    });
    return { id: report.id, status: report.status };
  }

  private async getOwnedOrFail(actor: { userId: string; role: string }, reportId: string) {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    const role = (actor.role ?? '').toUpperCase();
    const isModerator = role === 'MODERATOR' || role === 'ADMIN';
    if (report.userId !== actor.userId && !isModerator) {
      throw new ForbiddenException('No puedes modificar este reporte');
    }
    return report;
  }

  private async setLocation(id: string, lat: number, lng: number): Promise<void> {
    await this.reportRepo.query(
      `UPDATE reports SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      [lng, lat, id],
    );
  }

  private assertInsideBolivia(lat: number, lng: number): void {
    const inside =
      lat >= BOLIVIA_BOUNDS.minLat &&
      lat <= BOLIVIA_BOUNDS.maxLat &&
      lng >= BOLIVIA_BOUNDS.minLng &&
      lng <= BOLIVIA_BOUNDS.maxLng;
    if (!inside) {
      throw new BadRequestException('La ubicación del reporte debe estar dentro de Bolivia');
    }
  }
}
