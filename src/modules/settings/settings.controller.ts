import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserSettings } from './entities/user-settings.entity';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mis preferencias' })
  getMine(@CurrentUser('userId') userId: string): Promise<UserSettings> {
    return this.settingsService.getMine(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mis preferencias' })
  updateMine(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    return this.settingsService.updateMine(userId, dto);
  }
}
