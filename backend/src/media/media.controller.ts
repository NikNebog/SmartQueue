import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ensureUploadsDir } from './uploads-path';
import { MediaProcessingService } from './media-processing.service';
import {
  deleteMediaFilesByIds,
  removeMediaIdsFromBoardSettings,
} from './media-cleanup';

const allowedMediaExtensions = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov']);
const allowedMediaMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const allowedGenericMimeTypes = new Set(['', 'application/octet-stream']);

function isAllowedMediaUpload(ext: string, mimeType: string): boolean {
  if (!allowedMediaExtensions.has(ext)) {
    return false;
  }

  const normalizedMimeType = mimeType.trim().toLowerCase();

  return allowedMediaMimeTypes.has(normalizedMimeType)
    || allowedGenericMimeTypes.has(normalizedMimeType);
}

@Controller('media')
export class MediaController {
  constructor(
    private prisma: PrismaService,
    private mediaProcessingService: MediaProcessingService,
  ) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, ensureUploadsDir());
        },
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (isAllowedMediaUpload(ext, file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('РќРµРґРѕРїСѓСЃС‚РёРјС‹Р№ С‚РёРї С„Р°Р№Р»Р°'), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Р¤Р°Р№Р» РЅРµ РїРµСЂРµРґР°РЅ');
    }

    const isVideo = /mp4|webm|mov/.test(extname(file.originalname).toLowerCase());
    const processedFile = await this.mediaProcessingService.processUploadedFile(file, isVideo);

    return this.prisma.mediaFile.create({
      data: {
        type: isVideo ? 'video' : 'image',
        filename: processedFile.filename,
        url: processedFile.url,
      },
    });
  }

  @Get()
  findAll() {
    return this.prisma.mediaFile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('latest')
  async getLatest() {
    const [video, image] = await Promise.all([
      this.prisma.mediaFile.findFirst({
        where: { type: 'video' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaFile.findFirst({
        where: { type: 'image' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { video, image };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const mediaId = Number(id);
    const media = await this.prisma.mediaFile.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new BadRequestException('Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ');
    }

    const boardSettings = await this.prisma.boardSettings.findUnique({
      where: { id: 1 },
    });

    if (boardSettings?.settings) {
      const nextSettings = removeMediaIdsFromBoardSettings(
        boardSettings.settings,
        new Set([mediaId]),
      );

      await this.prisma.boardSettings.update({
        where: { id: 1 },
        data: { settings: nextSettings as never },
      });
    }

    await deleteMediaFilesByIds(this.prisma, [mediaId]);

    return { success: true };
  }
}
