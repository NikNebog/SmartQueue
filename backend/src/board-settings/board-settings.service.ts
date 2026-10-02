import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { collectBoardSettingsMediaIds, deleteMediaFilesByIds } from '../media/media-cleanup';

type BoardSettingsRecord = {
  settings: unknown;
};

const defaultBoardSettings = {
  boardType: 'general',
  liteMode: false,
  marqueeOffsetPx: 0,
  marqueeSizePercent: 100,
  marqueeText: '',
  promoMediaByProfileId: {},
  showMarquee: true,
  profiles: [],
  recentCallsLimit: 10,
  roomBoardId: '',
  screens: [],
  showRecentCalls: true,
  showTime: true,
  template: 'classic',
  voiceEnabled: true,
};

@Injectable()
export class BoardSettingsService {
  constructor(private prisma: PrismaService) {}

  private async loadStoredSettings(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.$queryRaw<BoardSettingsRecord[]>`
      SELECT "settings" FROM "board_settings"
      WHERE "id" = 1
      LIMIT 1
    `;

    const storedSettings = rows[0]?.settings;

    if (!storedSettings || typeof storedSettings !== 'object' || Array.isArray(storedSettings)) {
      return { ...defaultBoardSettings };
    }

    return storedSettings as Record<string, unknown>;
  }

  async getSettings() {
    return this.loadStoredSettings();
  }

  async saveSettings(settings: Record<string, unknown>) {
    const currentSettings = await this.loadStoredSettings();
    const nextSettings = {
      ...defaultBoardSettings,
      ...currentSettings,
      ...settings,
      profiles: Array.isArray(settings.profiles) ? settings.profiles : [],
      screens: Array.isArray(settings.screens) ? settings.screens : [],
    };
    const currentMediaIds = collectBoardSettingsMediaIds(currentSettings);
    const nextMediaIds = collectBoardSettingsMediaIds(nextSettings);
    const removedMediaIds = Array.from(currentMediaIds).filter((mediaId) => !nextMediaIds.has(mediaId));

    const rows = await this.prisma.$queryRaw<BoardSettingsRecord[]>`
      INSERT INTO "board_settings" ("id", "settings", "updatedAt")
      VALUES (1, ${JSON.stringify(nextSettings)}::jsonb, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "settings" = EXCLUDED."settings",
        "updatedAt" = NOW()
      RETURNING "settings"
    `;

    if (removedMediaIds.length > 0) {
      await deleteMediaFilesByIds(this.prisma, removedMediaIds);
    }

    return rows[0]?.settings ?? nextSettings;
  }
}
