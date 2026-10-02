import { Controller, Get, Delete, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get()
  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; password?: string; role?: any; roomId?: number; canManageTicketIssue?: boolean }
  ) {
    const updateData: any = {
      ...(body.name ? { name: body.name } : {}),
      ...(body.email ? { email: body.email } : {}),
      ...(body.role ? { role: body.role } : {}),
      ...(body.roomId !== undefined ? { roomId: body.roomId ? +body.roomId : null } : {}),
      ...(body.canManageTicketIssue !== undefined ? { canManageTicketIssue: Boolean(body.canManageTicketIssue) } : {}),
    };

    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    return this.prisma.user.update({
      where: { id: +id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/assign-room')
  assignRoom(
    @Param('id') id: string,
    @Body() body: { roomId: number }
  ) {
    return this.prisma.user.update({
      where: { id: +id },
      data: { roomId: body.roomId ? +body.roomId : null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prisma.user.delete({
      where: { id: +id },
    });
  }
}
