import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

/** Shared-secret guard for /bot/* integration endpoints. */
@Injectable()
export class BotKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const key = ctx.switchToHttp().getRequest().headers['x-bot-key'];
    if (!process.env.BOT_API_KEY || key !== process.env.BOT_API_KEY) throw new ForbiddenException('Invalid bot key');
    return true;
  }
}
