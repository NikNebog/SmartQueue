import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post('kiosk')
  createFromKiosk(
    @Body() body: { serviceTypeId: number | string; roomId?: number | string; language?: string },
  ) {
    return this.ticketsService.create(
      +body.serviceTypeId,
      1,
      body.roomId !== undefined ? +body.roomId : undefined,
      body.language,
    );
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  create(@Body() body: { serviceTypeId: number | string; priority?: number; roomId?: number | string; language?: string }) {
    return this.ticketsService.create(
      +body.serviceTypeId,
      body.priority,
      body.roomId !== undefined ? +body.roomId : undefined,
      body.language,
    );
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { roomId?: number; priority?: number; serviceTypeId?: number }
  ) {
    return this.ticketsService.updateTicket(+id, body);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Post(':id/arrive')
  arrive(@Param('id') id: string) {
    return this.ticketsService.arriveTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/no-show')
  noShow(@Param('id') id: string) {
    return this.ticketsService.noShowTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/postpone')
  postpone(@Param('id') id: string) {
    return this.ticketsService.postponeTicket(+id);
  }

@UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/return')
  returnTicket(@Param('id') id: string) {
    return this.ticketsService.returnTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get()
  async findAll(
    @Query('status') status: TicketStatus,
    @Query('roomId') roomId: string,
    @CurrentUser() user: any,
  ) {
    const finalRoomId = roomId ? +roomId : undefined;
    return this.ticketsService.findAll(status, finalRoomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/call')
  call(@Param('id') id: string) {
    return this.ticketsService.callTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.ticketsService.startService(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.ticketsService.completeTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancelTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Post(':id/redirect')
  redirect(@Param('id') id: string, @Body() body: { newRoomId: number }) {
    return this.ticketsService.redirectTicket(+id, body.newRoomId);
  }
}
