import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MediaProcessingService } from './media-processing.service';

@Module({
  controllers: [MediaController],
  providers: [PrismaService, MediaProcessingService],
})
export class MediaModule {}
