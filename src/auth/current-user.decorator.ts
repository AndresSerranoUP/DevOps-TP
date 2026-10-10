import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthJwtPayload } from './token.service';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthJwtPayload | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return null;
    return data ? user[data] : user;
  },
);
