import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator'; // ДОБАВИЛИ ИМПОРТ

@Controller('queue')
export class QueueController {
  constructor(private queueService: QueueService) {}

  // Для телевизора — без авторизации
  @Get('board')
  getBoardData() {
    return this.queueService.getBoardData();
  }

  // История вызовов для табло — без авторизации, только безопасные поля
  @Get('board-history')
  getBoardHistory() {
    return this.queueService.getBoardHistory();
  }

  // Аналитика — среднее время по услугам
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('analytics/service-time')
  getAvgTimeByServiceType() {
    return this.queueService.getAvgTimeByServiceType();
  }

  // Аналитика — за период
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('analytics/period')
  getAnalyticsByPeriod(@Query('period') period: string) {
    return this.queueService.getAnalyticsByPeriod(period);
  }

  // Для всех авторизованных
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('stats')
  getStats() {
    return this.queueService.getQueueStats();
  }

  // ИСПРАВЛЕНО: Защита от неопределенного roomId на фронтенде врача
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('room/:roomId')
  getQueueByRoom(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    let targetRoomId = +roomId;
    
    // Если зашел врач, берем ID кабинета прямо из его профиля в БД
    if (user && user.role === 'specialist' && user.roomId) {
      targetRoomId = user.roomId;
    }
    
    return this.queueService.getQueueByRoom(targetRoomId);
  }

  // ИСПРАВЛЕНО: Автоматический выбор следующего талона по кабинету врача
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Get('room/:roomId/next')
  getNextTicket(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    let targetRoomId = +roomId;
    
    if (user && user.role === 'specialist' && user.roomId) {
      targetRoomId = user.roomId;
    }
    
    return this.queueService.getNextTicket(targetRoomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post('room/:roomId/recalculate')
  recalculateETA(@Param('roomId') roomId: string) {
    return this.queueService.recalculateETA(+roomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('overload')
  checkOverload() {
    return this.queueService.checkOverload();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('high-priority')
  getHighPriority() {
    return this.queueService.getHighPriorityWaiting();
  }

  @Get('board/:roomId')
  getBoardByRoom(@Param('roomId') roomId: string) {
    return this.queueService.getBoardDataByRoom(roomId);
  }

}
