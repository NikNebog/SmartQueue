import { Module } from '@nestjs/common';
import { BoardScreensController } from './board-screens.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BoardScreensController],
  providers: [PrismaService],
})
export class BoardScreensModule {}
