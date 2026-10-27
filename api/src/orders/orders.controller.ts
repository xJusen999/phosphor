import { Body, Controller, Post } from '@nestjs/common';
import { priceOf } from '@phosphor/shared';
import type { BuildConfig } from '@phosphor/shared';
import { randomUUID } from 'node:crypto';
import { JsonStore, dataDir } from '../store/json-store';
import { OrderDto } from './orders.dto';

type Order = { id: string; config: BuildConfig; email: string; total: number; at: string };

@Controller('orders')
export class OrdersController {
  private readonly store = new JsonStore<Order>(`${dataDir()}/orders.json`);

  @Post()
  async create(@Body() dto: OrderDto) {
    const { caseFinish, keycaps, switchType } = dto.config;
    const config = { caseFinish, keycaps, switchType };
    const order = { id: randomUUID(), config, email: dto.email, total: priceOf(config), at: new Date().toISOString() };
    await this.store.append(order);
    return { id: order.id, total: order.total };
  }
}
