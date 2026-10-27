import { OPTIONS } from '@phosphor/shared';
import type { BuildConfig } from '@phosphor/shared';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { IsEmailAddress } from '../validators';

export class ConfigDto implements BuildConfig {
  @IsIn(Object.keys(OPTIONS.caseFinish)) caseFinish: BuildConfig['caseFinish'];
  @IsIn(Object.keys(OPTIONS.keycaps)) keycaps: BuildConfig['keycaps'];
  @IsIn(Object.keys(OPTIONS.switchType)) switchType: BuildConfig['switchType'];
}

export class OrderDto {
  @IsObject() @ValidateNested() @Type(() => ConfigDto) config: ConfigDto;
  @IsEmailAddress() email: string;
  // Accepted so the client may send it, but never trusted: the server recomputes the price.
  @IsOptional() @IsNumber() total?: number;
}
