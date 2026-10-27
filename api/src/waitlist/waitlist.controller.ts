import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JsonStore, dataDir } from '../store/json-store';
import { WaitlistDto } from './waitlist.dto';

type Entry = { email: string; at: string };

@Controller('waitlist')
export class WaitlistController {
  private readonly store = new JsonStore<Entry>(`${dataDir()}/waitlist.json`);

  @Post()
  @HttpCode(201)
  async join(@Body() dto: WaitlistDto, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase();
    const same = (e: Entry) => e.email === email;
    const { items, added } = await this.store.append({ email, at: new Date().toISOString() }, same);
    if (!added) res.status(200);
    return { ok: true, position: items.findIndex(same) + 1 };
  }
}
