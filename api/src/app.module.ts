import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { OrdersController } from './orders/orders.controller';
import { WaitlistController } from './waitlist/waitlist.controller';

@Module({
  controllers: [WaitlistController, OrdersController, LeaderboardController],
  providers: [{ provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }) }],
})
export class AppModule {}
