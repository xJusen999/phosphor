import { IsEmailAddress } from '../validators';

export class WaitlistDto {
  @IsEmailAddress()
  email: string;
}
