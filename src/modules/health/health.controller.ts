import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio y conexión a base de datos' })
  async check() {
    let db = 'down';
    let postgis: string | null = null;
    try {
      await this.dataSource.query('SELECT 1');
      db = 'up';
      const rows = await this.dataSource.query('SELECT PostGIS_Version() AS v');
      postgis = rows?.[0]?.v ?? null;
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      postgis,
      timestamp: new Date().toISOString(),
    };
  }
}
