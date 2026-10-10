import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';
import { RoleGuard } from './role.guard';
import { OptionalAuthMiddleware } from './optional-auth.middleware';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasher,
    TokenService,
    AuthService,
    JwtGuard,
    RoleGuard,
    OptionalAuthMiddleware,
  ],
  exports: [
    JwtModule,
    PasswordHasher,
    TokenService,
    AuthService,
    JwtGuard,
    RoleGuard,
    OptionalAuthMiddleware,
  ],
})
export class AuthModule {}
