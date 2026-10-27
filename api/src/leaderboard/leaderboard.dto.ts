import { IsNumber, Max, Min } from 'class-validator';
import { IsCleanName } from '../validators';

export class ScoreDto {
  @IsCleanName() name: string;
  @IsNumber() @Min(0) @Max(300) wpm: number;
  @IsNumber() @Min(0) @Max(1) accuracy: number;
}
