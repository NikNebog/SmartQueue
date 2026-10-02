import { Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get()
  findAll() {
    return this.recommendationsService.findAll();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.recommendationsService.resolve(Number(id));
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post('reset-tickets')
  resetTickets() {
    return this.recommendationsService.resetDailyTickets();
  }
}
