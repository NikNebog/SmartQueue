import { BadRequestException, Controller, ForbiddenException, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Маппинг из значений БД в то, что ждёт фронт
const placeTypeToFrontend: Record<string, string> = {
  CABINET: 'cabinet',
  WINDOW: 'window',
  TABLE: 'desk', // Frontend expects the stable `desk` resource type.
};

function normalizeRoomResponse(room: any) {
  if (!room) return room;
  return {
    ...room,
    // Фронт читает workStartTime / workEndTime (без "ing")
    workStartTime: room.workingStartTime ?? null,
    workEndTime: room.workingEndTime ?? null,
    estimatedWaitMinutes: room.estimatedWaitMinutes ?? null,
    ticketIssueEnabled: room.ticketIssueEnabled ?? true,
    isTicketIssueEnabled: room.ticketIssueEnabled ?? true,
    kioskEnabled: room.ticketIssueEnabled ?? true,
    // Нормализуем placeType под ожидания фронта
    placeType: placeTypeToFrontend[room.placeType] ?? 'cabinet',
    // Нормализуем вложенные serviceTypes
    serviceTypes: room.serviceTypes?.map((st: any) => ({
      ...st,
      ...st.serviceType,
      id: st.serviceType?.id ?? st.serviceTypeId,
      name: st.serviceType?.name,
    })),
  };
}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    const rooms = await this.roomsService.findAll();
    return rooms.map(normalizeRoomResponse);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const room = await this.roomsService.findOne(Number(id));
    return normalizeRoomResponse(room);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  async create(@Body() body: any) {
    const name =
      body.name?.trim() ||
      body.title?.trim() ||
      body.roomName?.trim() ||
      null;

    const room = await this.roomsService.create({
      name,
      serviceTypeIds: body.serviceTypeIds || body.services || [],
      isActive: body.isActive ?? body.active ?? true,
      ticketIssueEnabled: body.ticketIssueEnabled ?? body.isTicketIssueEnabled ?? body.kioskEnabled ?? true,
      estimatedWaitMinutes: body.estimatedWaitMinutes ?? body.estimated_wait_minutes,
      placeType: body.placeType,
      workingStartTime: body.workingStartTime ?? body.workStartTime,
      workingEndTime: body.workingEndTime ?? body.workEndTime,
    });

    return normalizeRoomResponse(room);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id') // Кавычка зафиксирована!
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    const roomId = Number(id);

    if (user?.role === 'specialist') {
      if (!user.roomId || Number(user.roomId) !== roomId) {
        throw new ForbiddenException('Врач может управлять выдачей талонов только в своем кабинете.');
      }

      const ticketIssueEnabled = body.ticketIssueEnabled ?? body.isTicketIssueEnabled ?? body.kioskEnabled;

      if (ticketIssueEnabled === undefined) {
        throw new BadRequestException('Для врача доступно только изменение выдачи талонов.');
      }

      const room = await this.roomsService.update(roomId, {
        ticketIssueEnabled: Boolean(ticketIssueEnabled),
      });
      return normalizeRoomResponse(room);
    }

    const room = await this.roomsService.update(roomId, body);
    return normalizeRoomResponse(room);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Patch(':id/ticket-issue')
  async updateTicketIssue(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    const roomId = Number(id);

    if (user?.role === 'specialist' && (!user.roomId || Number(user.roomId) !== roomId)) {
      throw new ForbiddenException('Врач может управлять выдачей талонов только в своем кабинете.');
    }

    if (user?.role === 'specialist' && user.canManageTicketIssue === false) {
      throw new ForbiddenException('Администратор запретил врачу управлять выдачей талонов.');
    }

    const ticketIssueEnabled = body.ticketIssueEnabled ?? body.isTicketIssueEnabled ?? body.kioskEnabled;

    if (ticketIssueEnabled === undefined) {
      throw new BadRequestException('Укажите ticketIssueEnabled.');
    }

    const room = await this.roomsService.update(roomId, {
      ticketIssueEnabled: Boolean(ticketIssueEnabled),
    });

    return normalizeRoomResponse(room);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.roomsService.deactivate(Number(id));
  }

  @Get(':id/queue')
  getQueue(@Param('id') id: string) {
    return this.roomsService.getQueue(Number(id));
  }
}
