import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardSettingsController } from './board-settings.controller';
import { BoardSettingsService } from './board-settings.service';

@Module({
  controllers: [BoardSettingsController],
  providers: [BoardSettingsService, PrismaService],
})
export class BoardSettingsModule {}
