import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  getSettings() {
    return this.appSettingsService.getSettings();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Patch()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.appSettingsService.updateSettings(body);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Put()
  replaceSettings(@Body() body: Record<string, unknown>) {
    return this.appSettingsService.updateSettings(body);
  }
}
