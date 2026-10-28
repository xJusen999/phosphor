import { Body, Controller, Get, Post } from '@nestjs/common';
import { byRank, cleanName } from '@phosphor/shared';
import { JsonStore, dataDir } from '../store/json-store';
import { ScoreDto } from './leaderboard.dto';

type Score = { name: string; wpm: number; accuracy: number; at: string };

@Controller('scores')
export class LeaderboardController {
  private readonly store = new JsonStore<Score>(`${dataDir()}/scores.json`);

  @Post()
  async submit(@Body() dto: ScoreDto) {
    const score: Score = { name: cleanName(dto.name)!, wpm: dto.wpm, accuracy: dto.accuracy, at: new Date().toISOString() };
    const { items } = await this.store.append(score);
    // On a full tie the newest entry (latest `at`) ranks below older ones.
    return { rank: [...items].sort(byRank).indexOf(score) + 1 };
  }

  @Get()
  async top() {
    return (await this.store.read()).sort(byRank).slice(0, 10);
  }
}
