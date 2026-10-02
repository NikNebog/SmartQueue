import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { BoardSettingsService } from './board-settings.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('board-settings')
export class BoardSettingsController {
  constructor(private readonly boardSettingsService: BoardSettingsService) {}

  @Get()
  getSettings() {
    return this.boardSettingsService.getSettings();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.boardSettingsService.saveSettings(body);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Put()
  replaceSettings(@Body() body: Record<string, unknown>) {
    return this.boardSettingsService.saveSettings(body);
  }
}
