import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { Language } from './entities/language.entity';

@ApiTags('languages')
@Controller('languages')
export class LanguagesController {
  constructor(
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Idiomas soportados (habilitados)' })
  findEnabled(): Promise<Language[]> {
    return this.languageRepo.find({ where: { enabled: true }, order: { code: 'ASC' } });
  }
}
