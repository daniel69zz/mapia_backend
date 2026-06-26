import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig } from '@core/config/configuration';
import { ReportStatus } from './entities/alert-report.entity';
import { ModerationAction, ModerationLog } from './entities/moderation-log.entity';

export type ConfidenceDecision = 'auto_publish' | 'ask_confirmation' | 'force_review';

export interface ConfidenceInput {
  confidence: number;
  requiresReview: boolean;
  category: string;
}

@Injectable()
export class ModerationService {
  private readonly config: AiConfig;

  constructor(
    configService: ConfigService,
    @InjectRepository(ModerationLog)
    private readonly logRepo: Repository<ModerationLog>,
  ) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  /**
   * Reglas de confianza:
   * - >= autoPublishThreshold (0.85) y sin flags  -> auto_publish
   * - >= reviewThreshold (0.60) y < 0.85          -> ask_confirmation
   * - < reviewThreshold, requiresReview o "otro"  -> force_review
   */
  decide(input: ConfidenceInput): ConfidenceDecision {
    if (input.requiresReview || input.category === 'otro') return 'force_review';
    if (input.confidence >= this.config.autoPublishThreshold) return 'auto_publish';
    if (input.confidence >= this.config.reviewThreshold) return 'ask_confirmation';
    return 'force_review';
  }

  statusForDecision(decision: ConfidenceDecision): ReportStatus {
    if (decision === 'auto_publish') return 'published';
    if (decision === 'ask_confirmation') return 'analyzed';
    return 'pending_review';
  }

  async log(params: {
    reportId: string;
    action: ModerationAction;
    fromStatus?: ReportStatus | null;
    toStatus?: ReportStatus | null;
    actorId?: string | null;
    reason?: string | null;
    metadata?: unknown;
  }): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        reportId: params.reportId,
        action: params.action,
        fromStatus: params.fromStatus ?? null,
        toStatus: params.toStatus ?? null,
        actorId: params.actorId ?? null,
        reason: params.reason ?? null,
        metadata: params.metadata ?? null,
      }),
    );
  }
}
