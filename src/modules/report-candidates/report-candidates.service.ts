import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PostStatus, PostType, PostVisibility } from '@common/enums/post.enums';
import { Post } from '@modules/posts/entities/post.entity';
import { PostsService } from '@modules/posts/posts.service';
import {
  ReportCandidate,
  ReportCandidateCategory,
  ReportCandidatePriority,
} from './entities/report-candidate.entity';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';

/** Resultado del informe ciudadano generado (shape consumido por el frontend). */
export interface GeneratedCitizenReport {
  title: string;
  generatedAt: string;
  municipality: string;
  candidatesCount: number;
  body: string;
  note: string;
}

export interface FeaturedReportCandidate {
  id: string;
  postId: string;
  title: string;
  summary: string;
  category: ReportCandidateCategory;
  status: 'pendiente_revision';
  priority: ReportCandidatePriority;
  locationText: string | null;
  lat: number;
  lng: number;
  evidenceUrls: string[];
  citizenSupportCount: number;
  commentsCount: number;
  createdAt: Date;
  aiSummary: string;
  suggestedSolution: string;
  rejectionReason: null;
  authorReputationScore: number | null;
  authorPostsCount: number;
}

/** Categoría + prioridad por defecto según el tipo de publicación. */
const TYPE_MAP: Record<
  PostType,
  { category: ReportCandidateCategory; priority: ReportCandidatePriority }
> = {
  [PostType.BLOCKADE]: { category: 'bloqueo', priority: 'alta' },
  [PostType.SERVICE_CUT]: { category: 'corte_servicio', priority: 'alta' },
  [PostType.TRAFFIC]: { category: 'transporte', priority: 'media' },
  [PostType.ACCIDENT]: { category: 'transporte', priority: 'alta' },
  [PostType.SECURITY]: { category: 'seguridad', priority: 'alta' },
  [PostType.SALE]: { category: 'venta_irregular', priority: 'baja' },
  [PostType.FOOD_DEAL]: { category: 'venta_irregular', priority: 'baja' },
  [PostType.PARTY]: { category: 'evento', priority: 'baja' },
  [PostType.NEWS]: { category: 'otro_problema_urbano', priority: 'media' },
  [PostType.NOVELTY]: { category: 'otro_problema_urbano', priority: 'baja' },
  [PostType.LOST_FOUND]: { category: 'otro_problema_urbano', priority: 'baja' },
  [PostType.OTHER]: { category: 'otro_problema_urbano', priority: 'media' },
};

/** Refinamiento por palabra clave (gana sobre el mapeo por tipo). */
const KEYWORD_CATEGORIES: { category: ReportCandidateCategory; keywords: string[] }[] = [
  { category: 'basura', keywords: ['basura', 'residuo', 'botadero', 'desecho'] },
  { category: 'bache', keywords: ['bache', 'hueco en la via', 'pavimento roto'] },
  { category: 'alumbrado', keywords: ['alumbrado', 'foco', 'poste', 'luminaria', 'sin luz'] },
];

const SOLUTIONS: Record<ReportCandidateCategory, string> = {
  bloqueo:
    'Coordinar con la Policía y la Alcaldía para habilitar vías alternas y mediar el conflicto.',
  corte_servicio:
    'Notificar a la empresa de servicios (agua/luz/gas) para restablecer el suministro.',
  basura: 'Solicitar al servicio municipal de aseo el recojo y limpieza de la zona.',
  bache: 'Reportar a la unidad de mantenimiento vial para el bacheo de la calzada.',
  alumbrado: 'Solicitar a la empresa eléctrica/Alcaldía la reposición del alumbrado público.',
  transporte: 'Coordinar con tránsito el ordenamiento vehicular y la señalización del punto.',
  seguridad: 'Reforzar el patrullaje policial y la iluminación en el sector afectado.',
  evento: 'Informar a la población y coordinar logística y seguridad del evento.',
  venta_irregular: 'Coordinar con Intendencia el control del comercio en vía pública.',
  otro_problema_urbano: 'Derivar el caso a la dependencia municipal competente para su atención.',
};

@Injectable()
export class ReportCandidatesService {
  constructor(
    @InjectRepository(ReportCandidate)
    private readonly candidateRepo: Repository<ReportCandidate>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly postsService: PostsService,
  ) {}

  /** Lista de candidatos, más recientes primero. */
  async findAll(): Promise<{ items: FeaturedReportCandidate[]; count: number }> {
    const posts = await this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .where('post.visibility = :visibility', { visibility: PostVisibility.PUBLIC })
      .andWhere('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.likesCount', 'DESC')
      .addOrderBy('profile.likesCount', 'DESC')
      .addOrderBy('post.commentsCount', 'DESC')
      .addOrderBy('post.createdAt', 'DESC')
      .take(20)
      .getMany();

    const items = posts.map((post) => this.toFeaturedCandidate(post));
    return { items, count: items.length };
  }

  /** Crea (o devuelve) el candidato asociado a una publicación. Idempotente. */
  async createFromPost(postId: string): Promise<ReportCandidate> {
    const existing = await this.candidateRepo.findOne({ where: { postId } });
    if (existing) return existing;

    const post = await this.postsService.getVisibleEntityOrFail(postId);
    const { category, priority } = this.classify(post);

    const candidate = this.candidateRepo.create({
      postId: post.id,
      title: post.title,
      summary: this.truncate(post.description, 400),
      category,
      status: 'pendiente_revision',
      priority,
      locationText: post.address,
      lat: post.latitude,
      lng: post.longitude,
      evidenceUrls: [],
      citizenSupportCount: post.likesCount,
      commentsCount: post.commentsCount,
      aiSummary: this.buildAiSummary(post, category),
      suggestedSolution: SOLUTIONS[category],
      rejectionReason: null,
    });

    return this.candidateRepo.save(candidate);
  }

  /** Actualiza el estado del candidato (revisión / informe). */
  async updateStatus(id: string, dto: UpdateCandidateStatusDto): Promise<ReportCandidate> {
    void id;
    void dto;
    throw new BadRequestException(
      'Los candidatos para alcaldia son un ranking decorativo y no se aprueban, rechazan ni incluyen.',
    );
  }

  /**
   * Genera un informe ciudadano agrupando los candidatos aprobados y los marca
   * como incluidos en el informe.
   */
  async generateReport(municipality: string): Promise<GeneratedCitizenReport> {
    const approved = await this.candidateRepo.find({
      where: { status: 'aprobado_para_informe' },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });

    const generatedAt = new Date();
    const body = this.buildReportBody(approved, municipality, generatedAt);

    if (approved.length > 0) {
      await this.candidateRepo.update(
        { id: In(approved.map((c) => c.id)) },
        { status: 'incluido_en_informe' },
      );
    }

    return {
      title: `Informe ciudadano - ${municipality}`,
      generatedAt: generatedAt.toISOString(),
      municipality,
      candidatesCount: approved.length,
      body,
      note:
        approved.length > 0
          ? 'Informe generado automáticamente a partir de los reportes ciudadanos aprobados. Revíselo antes de enviarlo a la autoridad competente.'
          : 'No hay reportes aprobados para incluir. Apruebe candidatos (estado "aprobado_para_informe") y vuelva a generar el informe.',
    };
  }

  private classify(post: Post): {
    category: ReportCandidateCategory;
    priority: ReportCandidatePriority;
  } {
    const base = TYPE_MAP[post.type] ?? TYPE_MAP[PostType.OTHER];
    const text = this.normalize(`${post.title} ${post.description}`);

    let category = base.category;
    for (const rule of KEYWORD_CATEGORIES) {
      if (rule.keywords.some((keyword) => text.includes(keyword))) {
        category = rule.category;
        break;
      }
    }

    let priority = base.priority;
    if (text.includes('urgente') || text.includes('emergencia') || text.includes('peligro')) {
      priority = 'urgente';
    }

    return { category, priority };
  }

  private buildAiSummary(post: Post, category: ReportCandidateCategory): string {
    const place = post.address ? ` en ${post.address}` : '';
    return `Reporte ciudadano de tipo "${category.replace(/_/g, ' ')}"${place}: ${this.truncate(
      post.description,
      220,
    )}`;
  }

  private toFeaturedCandidate(post: Post): FeaturedReportCandidate {
    const { category, priority } = this.classify(post);
    const profile = post.author?.profile;

    return {
      id: `featured-${post.id}`,
      postId: post.id,
      title: post.title,
      summary: this.truncate(post.description, 400),
      category,
      status: 'pendiente_revision',
      priority,
      locationText: post.address,
      lat: post.latitude,
      lng: post.longitude,
      evidenceUrls: [],
      citizenSupportCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      aiSummary: this.buildAiSummary(post, category),
      suggestedSolution: SOLUTIONS[category],
      rejectionReason: null,
      authorReputationScore: profile
        ? this.calculateReputationScore(
            profile.postsCount,
            profile.likesCount,
            profile.followersCount,
          )
        : null,
      authorPostsCount: profile?.postsCount ?? 0,
    };
  }

  private calculateReputationScore(
    postsCount: number,
    likesCount: number,
    followersCount: number,
  ): number | null {
    if (postsCount <= 0) return null;
    const averageLikes = likesCount / Math.max(postsCount, 1);
    const likesScore = Math.min(Math.max(averageLikes / 50, 0), 1) * 45;
    const communityScore = Math.min(Math.max(followersCount / 500, 0), 1) * 25;
    const consistencyScore = Math.min(Math.max(postsCount / 20, 0), 1) * 20;
    return Math.round(10 + likesScore + communityScore + consistencyScore);
  }

  private buildReportBody(
    candidates: ReportCandidate[],
    municipality: string,
    generatedAt: Date,
  ): string {
    const lines: string[] = [];
    lines.push(`INFORME CIUDADANO - ${municipality}`);
    lines.push(`Fecha de generación: ${generatedAt.toLocaleString('es-BO')}`);
    lines.push(`Reportes incluidos: ${candidates.length}`);
    lines.push('');

    if (candidates.length === 0) {
      lines.push('No hay reportes ciudadanos aprobados para este informe.');
      return lines.join('\n');
    }

    const grouped = new Map<ReportCandidateCategory, ReportCandidate[]>();
    for (const candidate of candidates) {
      const list = grouped.get(candidate.category) ?? [];
      list.push(candidate);
      grouped.set(candidate.category, list);
    }

    let index = 1;
    for (const [category, list] of grouped) {
      lines.push(`== ${category.replace(/_/g, ' ').toUpperCase()} (${list.length}) ==`);
      for (const candidate of list) {
        const location = candidate.locationText ? ` | Ubicación: ${candidate.locationText}` : '';
        lines.push(`${index}. ${candidate.title} [prioridad: ${candidate.priority}]${location}`);
        lines.push(`   Resumen: ${candidate.summary}`);
        if (candidate.suggestedSolution) {
          lines.push(`   Solución sugerida: ${candidate.suggestedSolution}`);
        }
        lines.push(
          `   Apoyo ciudadano: ${candidate.citizenSupportCount} | Comentarios: ${candidate.commentsCount}`,
        );
        lines.push('');
        index += 1;
      }
    }

    return lines.join('\n').trimEnd();
  }

  private truncate(value: string, max: number): string {
    const clean = (value ?? '').trim();
    return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
  }

  private normalize(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
