import { cleanName, isEmail } from '@phosphor/shared';
import { ValidationOptions, registerDecorator } from 'class-validator';

const make =
  (name: string, ok: (v: string) => boolean, message: string) =>
  (options?: ValidationOptions): PropertyDecorator =>
  (target, key) =>
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: key as string,
      options: { message, ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && ok(v) },
    });

export const IsEmailAddress = make('isEmailAddress', isEmail, '$property must be a valid email');
export const IsCleanName = make(
  'isCleanName',
  (v) => cleanName(v) !== null,
  '$property must be 1-16 letters, digits, space, underscore, dash or dot',
);
