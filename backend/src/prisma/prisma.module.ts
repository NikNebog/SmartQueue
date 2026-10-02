import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // доступен во всех модулях без импорта
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}