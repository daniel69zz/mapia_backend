import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { PaginatedResult, PaginationQueryDto } from '@common/dtos/pagination.dto';
import { ContentReport } from './entities/content-report.entity';
import { ReportsService } from './reports.service';
import { AiVisionService } from './ai-vision.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateCitizenReportDto } from './dto/create-citizen-report.dto';
import { ParseCitizenReportDto } from './dto/parse-citizen-report.dto';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';
import { NearbyReportsDto } from './dto/nearby-reports.dto';
import { ConfirmReportDto, RejectReportDto } from './dto/confirm-report.dto';

const MAX_REPORT_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly aiVision: AiVisionService,
  ) {}

  @Public()
  @Post('reports/parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estructurar texto libre de un reporte ciudadano' })
  parseCitizenReport(@Body() dto: ParseCitizenReportDto) {
    return this.reportsService.parseCitizenReport(dto);
  }

  @Public()
  @Post('reports/parse-with-images')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estructurar reporte combinando texto e imágenes (IA opcional)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 3 }], {
      limits: { fileSize: MAX_REPORT_IMAGE_BYTES },
    }),
  )
  parseCitizenReportWithImages(
    @Body() dto: ParseCitizenReportDto,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reportsService.parseCitizenReportWithImages(dto, files?.images ?? []);
  }

  @Post('reports/analyze-photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analizar una foto con IA (Vertex/Gemini) y crear el reporte' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_REPORT_IMAGE_BYTES } }))
  analyzePhoto(
    @CurrentUser('userId') userId: string,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body() dto: AnalyzePhotoDto,
  ) {
    return this.aiVision.analyzePhoto(userId, image, dto.latitude, dto.longitude);
  }

  @Public()
  @Get('reports/nearby')
  @ApiOperation({ summary: 'Reportes ciudadanos publicados cercanos (PostGIS)' })
  nearby(@Query() query: NearbyReportsDto) {
    return this.reportsService.findNearby(query.lat, query.lng, query.radius, query.category);
  }

  @Patch('reports/:id/confirm')
  @ApiOperation({ summary: 'Confirmar/editar la sugerencia de IA y publicar el reporte' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmReportDto,
  ) {
    return this.aiVision.confirm({ userId: user.userId, role: user.role }, id, dto);
  }

  @Patch('reports/:id/reject')
  @ApiOperation({ summary: 'Rechazar/cancelar un reporte' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReportDto,
  ) {
    return this.aiVision.reject({ userId: user.userId, role: user.role }, id, dto.reason);
  }

  @Public()
  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publicar reporte ciudadano para el mapa de alertas' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 3 }], {
      limits: { fileSize: MAX_REPORT_IMAGE_BYTES },
    }),
  )
  createCitizenReport(
    @Body() dto: CreateCitizenReportDto,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reportsService.createCitizenReport(dto, files?.images ?? []);
  }

  @Post('posts/:postId/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reportar una publicación' })
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReportDto,
  ): Promise<ContentReport> {
    return this.reportsService.create(postId, userId, dto);
  }

  @Get('reports')
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Listar reportes (solo moderación)' })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<ContentReport>> {
    return this.reportsService.findAll(query);
  }
}
