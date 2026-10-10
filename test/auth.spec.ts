import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../src/auth/token.service';
import { JwtGuard } from '../src/auth/jwt.guard';
import { RoleGuard, Roles } from '../src/auth/role.guard';
import { OptionalAuthMiddleware } from '../src/auth/optional-auth.middleware';
import { AuthService } from '../src/auth/auth.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthModule } from '../src/auth/auth.module';
import { LoginDto } from '../src/auth/auth.dto';
import { PasswordHasher } from '../src/auth/password-hasher';
import { AppConfig } from '../src/config/app-config';
import { ConfigService } from '@nestjs/config';
import { DataStore } from '../src/store/data-store';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '../src/auth/current-user.decorator';

describe('Auth module unit tests', () => {
  const appConfig = new AppConfig(new ConfigService({
    JWT_SECRET: 'super-secret-jwt-key-32-chars-minimum!',
    JWT_EXPIRATION_MINUTES: '60',
    ENCRYPTER_KEY: 'enc-key',
  }));
  const jwtService = new JwtService();
  const tokenService = new TokenService(jwtService, appConfig);
  const passwordHasher = new PasswordHasher();

  describe('TokenService', () => {
    it('signs and verifies a user without developer claims', () => {
      const token = tokenService.signUser({
        IdUser: 1,
        EmailUser: 'test@domain.com',
        UsernameUser: 'Tester',
        ImgAvatar: 'avatar.png',
        IdRole: 1,
      });

      expect(typeof token).toBe('string');
      const verified = tokenService.verify(token);
      expect(verified.nameid).toBe(1);
      expect(verified.email).toBe('test@domain.com');
      expect(verified.name).toBe('Tester');
      expect(verified.Avatar).toBe('avatar.png');
      expect(verified.role).toBe('1');
      expect(verified.Developer).toBeUndefined();
    });

    it('signs and verifies a user with developer claims', () => {
      const token = tokenService.signUser(
        {
          IdUser: 2,
          EmailUser: 'dev@studio.com',
          UsernameUser: 'DevUser',
          ImgAvatar: null,
          IdRole: 2,
        },
        {
          IdDeveloper: 10,
          NameDeveloper: 'IndieStudio',
        },
      );

      const verified = tokenService.verify(token);
      expect(verified.nameid).toBe(2);
      expect(verified.Developer).toBe('IndieStudio');
      expect(verified.DeveloperId).toBe('10');
    });

    it('throws error when verifying token with invalid secret', () => {
      const invalidToken = jwtService.sign({ sub: 123 }, { secret: 'different-secret' });
      expect(() => tokenService.verify(invalidToken)).toThrow();
    });
  });

  describe('JwtGuard', () => {
    it('accepts a bearer token and stores its claims in request.user', () => {
      const claims = { nameid: 7, role: '2', email: 'a@b.com', name: 'test', Avatar: '' };
      const mockTokenService = { verify: jest.fn().mockReturnValue(claims) } as unknown as TokenService;
      const request: { headers: { authorization: string }; user?: unknown } =
        { headers: { authorization: 'Bearer token' } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

      expect(new JwtGuard(mockTokenService).canActivate(context)).toBe(true);
      expect(request.user).toBe(claims);
      expect(mockTokenService.verify).toHaveBeenCalledWith('token');
    });

    it('returns true immediately if request.user is already set', () => {
      const request = { user: { nameid: 5 } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
      const mockTokenService = { verify: jest.fn() } as unknown as TokenService;

      expect(new JwtGuard(mockTokenService).canActivate(context)).toBe(true);
      expect(mockTokenService.verify).not.toHaveBeenCalled();
    });

    it.each([undefined, 'Basic token', 'Bearer ', ''])('rejects malformed authorization: %s', (authorization) => {
      const request = { headers: { authorization } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
      expect(() => new JwtGuard({ verify: jest.fn() } as unknown as TokenService).canActivate(context))
        .toThrow(UnauthorizedException);
    });

    it('maps invalid signatures to 401 Unauthorized', () => {
      const request = { headers: { authorization: 'Bearer bad' } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
      expect(() => new JwtGuard({ verify: () => { throw new Error('invalid'); } } as unknown as TokenService).canActivate(context))
        .toThrow(UnauthorizedException);
    });
  });

  describe('RoleGuard', () => {
    it('allows an administrator role and rejects a lower role before the handler', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['Administrator']) };
      const guard = new RoleGuard(reflector as never);
      const context = (user: Record<string, unknown>) => ({
        getHandler: () => undefined, getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as unknown as ExecutionContext;

      expect(guard.canActivate(context({ role: '4' }))).toBe(true);
      expect(() => guard.canActivate(context({ role: '1' }))).toThrow(ForbiddenException);
    });

    it('allows role check matching case-insensitively', () => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['Developer']) };
      const guard = new RoleGuard(reflector as never);
      const context = {
        getHandler: () => undefined, getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DEVELOPER' } }) }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('does not impose a role when the endpoint has no role metadata', () => {
      const guard = new RoleGuard({ getAllAndOverride: () => undefined } as never);
      const context = {
        getHandler: () => undefined, getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as unknown as ExecutionContext;
      expect(guard.canActivate(context)).toBe(true);
    });

    it('Roles decorator sets metadata', () => {
      class TestRoles {
        @Roles('Admin')
        testMethod() {}
      }
      expect(Reflect.getMetadata('roles', TestRoles.prototype.testMethod)).toEqual(['Admin']);
    });
  });

  describe('OptionalAuthMiddleware', () => {
    const middleware = new OptionalAuthMiddleware(tokenService);

    it('attaches verified payload to req.user when valid Bearer token provided', () => {
      const token = tokenService.signUser({ IdUser: 42, EmailUser: 'opt@auth.com' });
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();

      middleware.use(req, {} as any, next);
      expect(req.user).toBeDefined();
      expect(req.user.nameid).toBe(42);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sets req.user to undefined when token is invalid and still calls next', () => {
      const req: any = { headers: { authorization: 'Bearer invalid.token.value' } };
      const next = jest.fn();

      middleware.use(req, {} as any, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next without modifying req.user when header is missing', () => {
      const req: any = { headers: {} };
      const next = jest.fn();

      middleware.use(req, {} as any, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('CurrentUser decorator', () => {
    function getParamDecoratorFactory(_decorator: Function) {
      class TestClass {
        testMethod(@CurrentUser() _user: any, @CurrentUser('email') _email: any) {}
      }
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
      const key = Object.keys(args)[0];
      return args[key].factory;
    }

    it('extracts entire user or property from request', () => {
      const factory = getParamDecoratorFactory(CurrentUser);
      const mockContext = (user: any) => ({
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as ExecutionContext);

      expect(factory(undefined, mockContext({ nameid: 1, email: 'a@b.com' }))).toEqual({ nameid: 1, email: 'a@b.com' });
      expect(factory('email', mockContext({ nameid: 1, email: 'a@b.com' }))).toBe('a@b.com');
      expect(factory(undefined, mockContext(null))).toBeNull();
    });
  });

  describe('AuthService & AuthController', () => {
    it('login succeeds with verified user and developer data', async () => {
      const mockDataStore = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('Developers')) {
            return Promise.resolve([{ IdDeveloper: 5, NameDeveloper: 'MegaStudio' }]);
          }
          return Promise.resolve([{
            IdUser: 1,
            EmailUser: 'dev@test.com',
            UsernameUser: 'DevUser',
            ImgAvatar: 'avatar.png',
            IsVerified: true,
            IdRole: 2,
          }]);
        }),
      } as unknown as DataStore;

      const authService = new AuthService(mockDataStore, appConfig, passwordHasher, tokenService);
      const result = await authService.login({ emailUser: 'dev@test.com', passwordUser: 'pass' } as unknown as LoginDto);

      expect(result.idUser).toBe(1);
      expect(result.emailUser).toBe('dev@test.com');
      expect(result.token).toBeDefined();
      expect((result as any).IdUser).toBeUndefined();

      const controller = new AuthController(authService);
      const ctrlResult = await controller.login({ emailUser: 'dev@test.com', passwordUser: 'pass' } as unknown as LoginDto);
      expect(ctrlResult.idUser).toBe(1);
    });

    it('throws UnauthorizedException when credentials do not match any user', async () => {
      const mockDataStore = {
        query: jest.fn().mockResolvedValue([]),
      } as unknown as DataStore;

      const authService = new AuthService(mockDataStore, appConfig, passwordHasher, tokenService);
      await expect(authService.login({ emailUser: 'wrong@test.com', passwordUser: 'pass' } as unknown as LoginDto))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user email is not verified', async () => {
      const mockDataStore = {
        query: jest.fn().mockResolvedValue([{
          IdUser: 2,
          EmailUser: 'unverified@test.com',
          IsVerified: false,
        }]),
      } as unknown as DataStore;

      const authService = new AuthService(mockDataStore, appConfig, passwordHasher, tokenService);
      await expect(authService.login({ emailUser: 'unverified@test.com', passwordUser: 'pass' } as unknown as LoginDto))
        .rejects.toThrow('User needs to verify its email to login to this website!');
    });

    it('AuthModule is defined', () => {
      expect(AuthModule).toBeDefined();
      const module = new AuthModule();
      expect(module).toBeInstanceOf(AuthModule);
    });
  });
});
