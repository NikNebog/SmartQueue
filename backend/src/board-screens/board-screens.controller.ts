import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('board-screens')
export class BoardScreensController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.boardScreen.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  create(@Body() body: { name: string; roomNames: string[] }) {
    return this.prisma.boardScreen.create({
      data: { name: body.name, roomNames: body.roomNames },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prisma.boardScreen.delete({ where: { id: +id } });
  }
}
