import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { getUploadsDir } from './uploads-path';

const DEFAULT_VIDEO_WIDTH = Number(process.env.MEDIA_VIDEO_WIDTH ?? 854);
const DEFAULT_VIDEO_HEIGHT = Number(process.env.MEDIA_VIDEO_HEIGHT ?? 480);
const DEFAULT_VIDEO_FPS = Number(process.env.MEDIA_VIDEO_FPS ?? 25);
const DEFAULT_VIDEO_BITRATE = process.env.MEDIA_VIDEO_BITRATE ?? '900k';
const DEFAULT_VIDEO_MAXRATE = process.env.MEDIA_VIDEO_MAXRATE ?? '1100k';
const DEFAULT_VIDEO_BUFSIZE = process.env.MEDIA_VIDEO_BUFSIZE ?? '1800k';
const DEFAULT_AUDIO_BITRATE = process.env.MEDIA_AUDIO_BITRATE ?? '128k';
const DEFAULT_AUDIO_SAMPLE_RATE = process.env.MEDIA_AUDIO_SAMPLE_RATE ?? '48000';
const FFMPEG_PATH = (process.env.FFMPEG_PATH ?? 'ffmpeg').trim() || 'ffmpeg';

type ProcessedMediaFile = {
  filename: string;
  url: string;
};

@Injectable()
export class MediaProcessingService {
  async processUploadedFile(file: Express.Multer.File, isVideo: boolean): Promise<ProcessedMediaFile> {
    if (!isVideo) {
      return {
        filename: file.filename,
        url: `/uploads/${file.filename}`,
      };
    }

    const uploadsDir = getUploadsDir();
    const sourcePath = file.path || join(uploadsDir, file.filename);
    const targetFilename = `${this.getFileStem(file.filename)}-rpi.mp4`;
    const targetPath = join(uploadsDir, targetFilename);

    try {
      await this.runFfmpeg(sourcePath, targetPath);
      await fs.unlink(sourcePath).catch(() => undefined);

      return {
        filename: targetFilename,
        url: `/uploads/${targetFilename}`,
      };
    } catch (error) {
      await fs.unlink(targetPath).catch(() => undefined);
      await fs.unlink(sourcePath).catch(() => undefined);
      throw error;
    }
  }

  private getFileStem(filename: string): string {
    const fileExtension = extname(filename);
    return fileExtension ? filename.slice(0, -fileExtension.length) : filename;
  }

  private async runFfmpeg(sourcePath: string, targetPath: string): Promise<void> {
    const args = [
      '-y',
      '-i',
      sourcePath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-level',
      '3.1',
      '-vf',
      `scale=${DEFAULT_VIDEO_WIDTH}:${DEFAULT_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${DEFAULT_VIDEO_WIDTH}:${DEFAULT_VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,fps=${DEFAULT_VIDEO_FPS}`,
      '-r',
      String(DEFAULT_VIDEO_FPS),
      '-g',
      String(DEFAULT_VIDEO_FPS * 2),
      '-b:v',
      DEFAULT_VIDEO_BITRATE,
      '-maxrate',
      DEFAULT_VIDEO_MAXRATE,
      '-bufsize',
      DEFAULT_VIDEO_BUFSIZE,
      '-c:a',
      'aac',
      '-b:a',
      DEFAULT_AUDIO_BITRATE,
      '-ar',
      DEFAULT_AUDIO_SAMPLE_RATE,
      '-movflags',
      '+faststart',
      targetPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(FFMPEG_PATH, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderr = '';

      ffmpegProcess.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      ffmpegProcess.on('error', (error) => {
        reject(new InternalServerErrorException(
          `Не удалось запустить ffmpeg. Проверьте, что он установлен в окружении backend. ${error.message}`,
        ));
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new InternalServerErrorException(
          `Конвертация видео завершилась с ошибкой.${stderr ? ` ${stderr.trim()}` : ''}`,
        ));
      });
    });
  }
}
