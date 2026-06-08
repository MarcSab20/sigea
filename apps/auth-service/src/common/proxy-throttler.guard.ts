import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xff = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    return xff || req.ip;
  }
}