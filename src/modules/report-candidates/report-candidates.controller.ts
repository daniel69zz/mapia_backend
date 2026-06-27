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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { ReportCandidatesService } from './report-candidates.service';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';
import { GenerateReportDto } from './dto/generate-report.dto';

@ApiTags('report-candidates')
@Controller()
export class ReportCandidatesController {
  constructor(private readonly service: ReportCandidatesService) {}

  @Public()
  @Get('report-candidates')
  @ApiOperation({ summary: 'Listar candidatos a informe ciudadano' })
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Post('report-candidates/from-post/:postId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un candidato a informe a partir de una publicación' })
  createFromPost(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.service.createFromPost(postId);
  }

  @Public()
  @Patch('report-candidates/:id/status')
  @ApiOperation({ summary: 'Actualizar el estado de un candidato a informe' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCandidateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Public()
  @Post('reports/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar un informe ciudadano con los candidatos aprobados' })
  generate(@Body() dto: GenerateReportDto) {
    return this.service.generateReport(dto.municipality ?? 'Información no disponible');
  }
}
