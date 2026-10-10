import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: any }>();
    if (request.user) {
      return true;
    }
    const header = request.headers?.authorization;
    if (!header?.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
      throw new UnauthorizedException();
    }
    try {
      request.user = this.tokenService.verify(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
