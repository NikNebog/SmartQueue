import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('staff')
export class StaffController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get()
  findAll() {
    return this.prisma.user.findMany({
      where: { role: Role.specialist },
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
  @Roles('admin', 'manager')
  @Post()
  async create(
    @Body() body: { name: string; email: string; password: string; roomId?: number; canManageTicketIssue?: boolean },
  ) {
    const password = await bcrypt.hash(body.password, 10);

    return this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        password,
        role: Role.specialist,
        roomId: body.roomId ? +body.roomId : null,
        canManageTicketIssue: body.canManageTicketIssue ?? true,
      },
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
  @Roles('admin', 'manager')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; password?: string; roomId?: number; canManageTicketIssue?: boolean },
  ) {
    const updateData: {
      email?: string;
      name?: string;
      password?: string;
      roomId?: number | null;
      canManageTicketIssue?: boolean;
    } = {
      ...(body.name ? { name: body.name } : {}),
      ...(body.email ? { email: body.email } : {}),
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
  @Roles('admin', 'manager')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prisma.user.delete({
      where: { id: +id },
    });
  }
}
