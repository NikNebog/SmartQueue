import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';

@Module({
  controllers: [AppSettingsController],
  providers: [AppSettingsService, PrismaService],
})
export class AppSettingsModule {}
