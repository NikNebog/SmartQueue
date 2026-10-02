import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AppSettingsPayload = {
  appIcon?: string;
  appName?: string;
  logoDataUrl?: string;
};

function toClientSettings(settings: { appName: string; appIcon: string }) {
  return {
    appName: settings.appName || 'SmartQ',
    logoDataUrl: settings.appIcon === 'default_icon.png' ? '' : settings.appIcon,
  };
}

@Injectable()
export class AppSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { appName: 'SmartQ' },
    });

    return toClientSettings(settings);
  }

  async updateSettings(data: AppSettingsPayload) {
    const appName = data.appName?.trim() || 'SmartQ';
    const appIcon = data.logoDataUrl ?? data.appIcon ?? '';

    const settings = await this.prisma.appSettings.upsert({
      where: { id: 1 },
      update: { appIcon, appName },
      create: { appIcon, appName },
    });

    return toClientSettings(settings);
  }
}
