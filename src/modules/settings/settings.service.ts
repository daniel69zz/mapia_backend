import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoConfig } from '@core/config/configuration';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    private readonly configService: ConfigService,
  ) {}

  /** Crea settings por defecto al registrarse. */
  createDefaults(userId: string): Promise<UserSettings> {
    const geo = this.configService.get<GeoConfig>('geo')!;
    const settings = this.settingsRepo.create({
      userId,
      languageCode: 'es',
      defaultRadiusKm: geo.defaultRadiusKm,
      notificationsEnabled: true,
    });
    return this.settingsRepo.save(settings);
  }

  /** Devuelve settings; si no existen (usuario legacy), los crea. */
  async getMine(userId: string): Promise<UserSettings> {
    const existing = await this.settingsRepo.findOne({ where: { userId } });
    return existing ?? this.createDefaults(userId);
  }

  async updateMine(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const settings = await this.getMine(userId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }
}
