import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: Record<string, unknown> }>();
    const role = String(request.user?.role ?? request.user?.Role ?? '').toLowerCase();
    if (
      !required.map(value => value.toLowerCase()).includes(role) &&
      !(required.includes('Administrator') && role === '4')
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}
