import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';

@Module({
  controllers: [TerminalsController],
  providers: [TerminalsService, PrismaService],
})
export class TerminalsModule {}
