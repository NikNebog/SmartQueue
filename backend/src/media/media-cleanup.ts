import { PrismaClient } from '@prisma/client';
import { basename, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { getUploadsDir } from './uploads-path';

type PromoMediaItem = {
  id?: unknown;
};

type PromoMediaRecord = {
  imageId?: unknown;
  imageItems?: PromoMediaItem[];
  videoId?: unknown;
  videoItems?: PromoMediaItem[];
};

type BoardSettingsPayload = {
  promoMediaByProfileId?: Record<string, PromoMediaRecord>;
};

function toPositiveInteger(value: unknown): number | null {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function collectIdsFromPromoMedia(media: PromoMediaRecord | undefined): number[] {
  if (!media || typeof media !== 'object') {
    return [];
  }

  const ids = new Set<number>();

  const imageId = toPositiveInteger(media.imageId);
  if (imageId !== null) {
    ids.add(imageId);
  }

  const videoId = toPositiveInteger(media.videoId);
  if (videoId !== null) {
    ids.add(videoId);
  }

  for (const item of Array.isArray(media.imageItems) ? media.imageItems : []) {
    const itemId = toPositiveInteger(item?.id);
    if (itemId !== null) {
      ids.add(itemId);
    }
  }

  for (const item of Array.isArray(media.videoItems) ? media.videoItems : []) {
    const itemId = toPositiveInteger(item?.id);
    if (itemId !== null) {
      ids.add(itemId);
    }
  }

  return Array.from(ids);
}

export function collectBoardSettingsMediaIds(settings: unknown): Set<number> {
  if (!settings || typeof settings !== 'object') {
    return new Set<number>();
  }

  const promoMediaByProfileId = (settings as BoardSettingsPayload).promoMediaByProfileId;

  if (!promoMediaByProfileId || typeof promoMediaByProfileId !== 'object') {
    return new Set<number>();
  }

  const ids = new Set<number>();

  for (const media of Object.values(promoMediaByProfileId)) {
    for (const id of collectIdsFromPromoMedia(media)) {
      ids.add(id);
    }
  }

  return ids;
}

export function removeMediaIdsFromBoardSettings(settings: unknown, mediaIds: Set<number>): unknown {
  if (!settings || typeof settings !== 'object' || mediaIds.size === 0) {
    return settings;
  }

  const source = settings as BoardSettingsPayload;
  const promoMediaByProfileId = source.promoMediaByProfileId;

  if (!promoMediaByProfileId || typeof promoMediaByProfileId !== 'object') {
    return settings;
  }

  const nextPromoMediaEntries: Array<[string, PromoMediaRecord]> = [];

  for (const [profileId, media] of Object.entries(promoMediaByProfileId)) {
        const nextImageItems = (Array.isArray(media?.imageItems) ? media.imageItems : [])
          .filter((item) => {
            const itemId = toPositiveInteger(item?.id);
            return itemId === null || !mediaIds.has(itemId);
          });
        const nextVideoItems = (Array.isArray(media?.videoItems) ? media.videoItems : [])
          .filter((item) => {
            const itemId = toPositiveInteger(item?.id);
            return itemId === null || !mediaIds.has(itemId);
          });
        const firstImage = nextImageItems[0];
        const firstVideo = nextVideoItems[0];
        const nextImageId = toPositiveInteger(firstImage?.id);
        const nextVideoId = toPositiveInteger(firstVideo?.id);

        const nextMedia = {
          ...media,
          imageId: nextImageId ?? undefined,
          imageItems: nextImageItems,
          imageName: firstImage && 'name' in firstImage ? firstImage.name : undefined,
          imageUrl: firstImage && 'url' in firstImage ? firstImage.url : undefined,
          videoId: nextVideoId ?? undefined,
          videoItems: nextVideoItems,
          videoName: firstVideo && 'name' in firstVideo ? firstVideo.name : undefined,
          videoUrl: firstVideo && 'url' in firstVideo ? firstVideo.url : undefined,
        };

        const hasMedia = Boolean(nextMedia.imageItems.length || nextMedia.videoItems.length);

        if (hasMedia) {
          nextPromoMediaEntries.push([profileId, nextMedia]);
        }
  }

  return {
    ...source,
    promoMediaByProfileId: Object.fromEntries(nextPromoMediaEntries),
  };
}

export async function deleteMediaFilesByIds(prisma: PrismaClient, mediaIds: Iterable<number>): Promise<void> {
  const uniqueIds = Array.from(new Set(
    Array.from(mediaIds)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ));

  if (uniqueIds.length === 0) {
    return;
  }

  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      id: { in: uniqueIds },
    },
  });

  for (const mediaFile of mediaFiles) {
    const filePath = join(getUploadsDir(), basename(mediaFile.filename));

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  await prisma.mediaFile.deleteMany({
    where: {
      id: { in: uniqueIds },
    },
  });
}
