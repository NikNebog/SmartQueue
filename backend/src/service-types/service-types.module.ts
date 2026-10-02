import { Module } from '@nestjs/common';
import { ServiceTypesController } from './service-types.controller';
import { ServiceTypesService } from './service-types.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ServiceTypesController],
  providers: [ServiceTypesService, PrismaService],
})
export class ServiceTypesModule {}