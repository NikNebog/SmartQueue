import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { QueueModule } from './queue/queue.module';
import { RoomsModule } from './rooms/rooms.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { BoardScreensModule } from './board-screens/board-screens.module';
import { TerminalsModule } from './terminals/terminals.module';
import { BoardSettingsModule } from './board-settings/board-settings.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    TicketsModule,
    QueueModule,
    RoomsModule,
    ServiceTypesModule,
    AnalyticsModule,
    RecommendationsModule,
    RealtimeModule,
    UsersModule,
    BoardScreensModule,
    TerminalsModule,
    BoardSettingsModule,
    AppSettingsModule,
    MediaModule,
  ],
  controllers: [UsersController],
})
export class AppModule {}
