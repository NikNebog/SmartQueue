import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController, StaffController],
})
export class UsersModule {}
