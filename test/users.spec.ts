import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersMapper } from '../src/users/users.mapper';
import { UsersRepository } from '../src/users/users.repository';
import { UsersService } from '../src/users/users.service';
import { UsersController } from '../src/users/users.controller';
import { UsersModule } from '../src/users/users.module';
import { UserCreateDto, UserUpdateDto } from '../src/users/users.dto';
import { PasswordHasher } from '../src/auth/password-hasher';
import { TokenService } from '../src/auth/token.service';
import { MailService } from '../src/mail/mail.service';
import { AppConfig } from '../src/config/app-config';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataStore } from '../src/store/data-store';

describe('Users module unit tests', () => {
  const appConfig = new AppConfig(new ConfigService({
    JWT_SECRET: 'jwt-key-32-characters-required-here!',
    ENCRYPTER_KEY: 'test-enc-key',
    PUBLIC_API_URL: 'http://api.test',
    FRONTEND_URL: 'http://app.test',
  }));
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService(new JwtService(), appConfig);

  describe('UsersMapper', () => {
    it('maps DB row to response with clean camelCase keys', () => {
      const row = {
        IdUser: 1,
        EmailUser: 'test@example.com',
        UsernameUser: 'TestUser',
        ImgAvatar: 'avatar.png',
        IdRole: 1,
        Disabled: 0,
        IsVerified: true,
      };
      const res = UsersMapper.toResponse(row);
      expect(res.idUser).toBe(1);
      expect((res as any).IdUser).toBeUndefined();
      expect(res.emailUser).toBe('test@example.com');
      expect((res as any).EmailUser).toBeUndefined();
      expect(res.usernameUser).toBe('TestUser');
      expect((res as any).UsernameUser).toBeUndefined();
      expect(res.imgAvatar).toBe('avatar.png');
      expect((res as any).ImgAvatar).toBeUndefined();
      expect(res.idRole).toBe(1);
      expect((res as any).IdRole).toBeUndefined();
      expect(res.disabled).toBe(0);
      expect((res as any).Disabled).toBeUndefined();
      expect(res.isVerified).toBe(true);
      expect((res as any).IsVerified).toBeUndefined();
    });

    it('handles null / undefined fields gracefully', () => {
      const res = UsersMapper.toResponse({ IdUser: 2, EmailUser: 'b@c.com' });
      expect(res.usernameUser).toBe('undefined');
      expect(res.imgAvatar).toBeNull();
      expect(res.idRole).toBeNull();
      expect(res.disabled).toBe(0);
      expect(res.isVerified).toBeNull();
    });
  });

  describe('UsersRepository', () => {
    let mockStore: {
      select: jest.Mock;
      count: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
    };
    let repo: UsersRepository;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        count: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
      };
      repo = new UsersRepository(mockStore as unknown as DataStore);
    });

    it('findById calls select with where IdUser', async () => {
      mockStore.select.mockResolvedValue([{ IdUser: 1, EmailUser: 'a@b.com' }]);
      const user = await repo.findById(1);
      expect(user).toEqual({ IdUser: 1, EmailUser: 'a@b.com' });
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Users', where: { IdUser: 1 } });
    });

    it('findByEmail calls select with where EmailUser', async () => {
      mockStore.select.mockResolvedValue([]);
      const user = await repo.findByEmail('missing@b.com');
      expect(user).toBeUndefined();
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Users', where: { EmailUser: 'missing@b.com' } });
    });

    it('countAll calls count with table Users', async () => {
      mockStore.count.mockResolvedValue(42);
      expect(await repo.countAll()).toBe(42);
      expect(mockStore.count).toHaveBeenCalledWith({ table: 'Users' });
    });

    it('findPaged calls select with offset, limit and ordering', async () => {
      mockStore.select.mockResolvedValue([{ IdUser: 1 }]);
      const res = await repo.findPaged(10, 5, 'UsernameUser', false);
      expect(res).toEqual([{ IdUser: 1 }]);
      expect(mockStore.select).toHaveBeenCalledWith({
        table: 'Users',
        offset: 10,
        limit: 5,
        orderBy: 'UsernameUser',
        ascending: false,
      });
    });

    it('create calls insert with Users table', async () => {
      mockStore.insert.mockResolvedValue({ IdUser: 10 });
      const res = await repo.create({ EmailUser: 'x@y.com' });
      expect(res).toEqual({ IdUser: 10 });
      expect(mockStore.insert).toHaveBeenCalledWith('Users', { EmailUser: 'x@y.com' });
    });

    it('update calls update and returns updated row or falls back to findById', async () => {
      mockStore.update.mockResolvedValue([{ IdUser: 1, EmailUser: 'updated@b.com' }]);
      const res = await repo.update(1, { EmailUser: 'updated@b.com' });
      expect(res).toEqual({ IdUser: 1, EmailUser: 'updated@b.com' });

      // Fallback path when update returns empty array
      mockStore.update.mockResolvedValue([]);
      mockStore.select.mockResolvedValue([{ IdUser: 1, EmailUser: 'refetched@b.com' }]);
      const resFallback = await repo.update(1, { EmailUser: 'updated@b.com' });
      expect(resFallback).toEqual({ IdUser: 1, EmailUser: 'refetched@b.com' });
    });

    it('softDelete updates Disabled: 1 and returns boolean', async () => {
      mockStore.update.mockResolvedValue([{ IdUser: 1 }]);
      expect(await repo.softDelete(1)).toBe(true);
      expect(mockStore.update).toHaveBeenCalledWith('Users', { IdUser: 1 }, { Disabled: 1 });

      mockStore.update.mockResolvedValue([]);
      expect(await repo.softDelete(999)).toBe(false);
    });
  });

  describe('UsersService', () => {
    let usersRepo: {
      findById: jest.Mock;
      findByEmail: jest.Mock;
      countAll: jest.Mock;
      findPaged: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      softDelete: jest.Mock;
    };
    let mailService: {
      sendVerificationEmail: jest.Mock;
      sendPasswordResetEmail: jest.Mock;
    };
    let dataStore: {
      query: jest.Mock;
    };
    let service: UsersService;

    beforeEach(() => {
      usersRepo = {
        findById: jest.fn(),
        findByEmail: jest.fn(),
        countAll: jest.fn(),
        findPaged: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      };
      mailService = {
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      };
      dataStore = {
        query: jest.fn().mockResolvedValue([]),
      };
      service = new UsersService(
        usersRepo as unknown as UsersRepository,
        passwordHasher,
        tokenService,
        mailService as unknown as MailService,
        appConfig,
        dataStore as unknown as DataStore,
      );
    });

    it('getAll returns paginated user responses', async () => {
      usersRepo.countAll.mockResolvedValue(1);
      usersRepo.findPaged.mockResolvedValue([
        { IdUser: 1, EmailUser: 'u@test.com', UsernameUser: 'u' },
      ]);
      const res = await service.getAll({ page: 1, pageSize: 10, ascending: true });
      expect(res.pageNumber).toBe(1);
      expect(res.results).toHaveLength(1);
      expect(res.results[0].idUser).toBe(1);
    });

    it('getById returns mapped user or throws NotFoundException', async () => {
      usersRepo.findById.mockResolvedValue({ IdUser: 1, EmailUser: 'u@test.com' });
      const user = await service.getById(1);
      expect(user.idUser).toBe(1);

      usersRepo.findById.mockResolvedValue(undefined);
      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });

    it('create registers user, hashes password, and sends verification email', async () => {
      usersRepo.findByEmail.mockResolvedValue(undefined);
      usersRepo.create.mockResolvedValue({ IdUser: 5 });

      const dto = {
        emailUser: 'new@test.com',
        passwordUser: 'Secret123',
        usernameUser: 'Newbie',
        imgAvatar: 'pic.png',
      } as unknown as UserCreateDto;
      const msg = await service.create(dto);

      expect(msg).toBe('User registered. Check your email for verification.');
      expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        EmailUser: 'new@test.com',
        UsernameUser: 'Newbie',
        ImgAvatar: 'pic.png',
        IdRole: 1,
        Disabled: 0,
      }));
      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('create throws ConflictException when email is already registered', async () => {
      usersRepo.findByEmail.mockResolvedValue({ IdUser: 1 });
      await expect(service.create({ emailUser: 'dup@test.com', passwordUser: 'p', usernameUser: 'u' } as unknown as UserCreateDto))
        .rejects.toThrow(ConflictException);
    });

    it('verifyEmail verifies user with valid unverified email', async () => {
      usersRepo.findByEmail.mockResolvedValue({ IdUser: 3, EmailUser: 'test@b.com', IsVerified: false });
      const ok = await service.verifyEmail('test@b.com');
      expect(ok).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith(3, { IsVerified: true, HashUser: null });
    });

    it('verifyEmail throws BadRequestException when email is empty, user not found, or already verified', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(BadRequestException);

      usersRepo.findByEmail.mockResolvedValue(undefined);
      await expect(service.verifyEmail('notfound@b.com')).rejects.toThrow(BadRequestException);

      usersRepo.findByEmail.mockResolvedValue({ IdUser: 3, IsVerified: true });
      await expect(service.verifyEmail('verified@b.com')).rejects.toThrow('User was already verified!');
    });

    it('passwordVerification sends reset email if account exists and returns message', async () => {
      usersRepo.findByEmail.mockResolvedValue({ IdUser: 3, EmailUser: 'exist@b.com' });
      const res = await service.passwordVerification('exist@b.com');
      expect(res).toBe('If the account exists, a mail will be sent to that account!');
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'exist@b.com',
        expect.stringContaining('reset-password?email=exist%40b.com'),
      );

      // Email does not exist
      usersRepo.findByEmail.mockResolvedValue(undefined);
      const res2 = await service.passwordVerification('none@b.com');
      expect(res2).toBe('If the account exists, a mail will be sent to that account!');

      // Empty email
      const res3 = await service.passwordVerification('');
      expect(res3).toBe('If the account exists, a mail will be sent to that account!');
    });

    it('updatePassword changes password when passwords match', async () => {
      usersRepo.findById.mockResolvedValue({ IdUser: 4 });
      const res = await service.updatePassword(4, 'newpass', 'newpass');
      expect(res).toBe('<html><body>Password Changed!</body></html>');
      expect(usersRepo.update).toHaveBeenCalledWith(4, expect.objectContaining({
        PasswordUser: expect.any(String),
      }));
    });

    it('updatePassword throws BadRequestException for mismatch or NotFoundException if user not found', async () => {
      await expect(service.updatePassword(4, 'pass', 'diff')).rejects.toThrow(BadRequestException);
      await expect(service.updatePassword(4, '', '')).rejects.toThrow(BadRequestException);

      usersRepo.findById.mockResolvedValue(undefined);
      await expect(service.updatePassword(4, 'pass', 'pass')).rejects.toThrow(NotFoundException);
    });

    it('update updates user fields and re-signs token with developer if assigned', async () => {
      usersRepo.findById
        .mockResolvedValueOnce({ IdUser: 10, EmailUser: 'u@b.com' })
        .mockResolvedValueOnce({ IdUser: 10, EmailUser: 'new@b.com', UsernameUser: 'Updated', ImgAvatar: 'av.png', IdRole: 2 });
      dataStore.query.mockResolvedValue([{ IdDeveloper: 8, NameDeveloper: 'Studios' }]);

      const token = await service.update(10, {
        emailUser: 'new@b.com',
        usernameUser: 'Updated',
        imgAvatar: 'av.png',
      } as unknown as UserUpdateDto);
      expect(typeof token).toBe('string');
      const payload = tokenService.verify(token);
      expect(payload.Developer).toBe('Studios');
      expect(payload.nameid).toBe(10);
    });

    it('update throws NotFoundException if user not found', async () => {
      usersRepo.findById.mockResolvedValue(undefined);
      await expect(service.update(999, {} as unknown as UserUpdateDto)).rejects.toThrow(NotFoundException);
    });

    it('delete soft deletes user or throws NotFoundException', async () => {
      usersRepo.findById.mockResolvedValue({ IdUser: 1 });
      usersRepo.softDelete.mockResolvedValue(true);
      expect(await service.delete(1)).toBe(true);

      usersRepo.findById.mockResolvedValue(undefined);
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('UsersController', () => {
    let mockService: any;
    let controller: UsersController;

    beforeEach(() => {
      mockService = {
        getAll: jest.fn().mockResolvedValue({ results: [] }),
        getById: jest.fn().mockResolvedValue({ idUser: 1 }),
        create: jest.fn().mockResolvedValue('ok'),
        verifyEmail: jest.fn().mockResolvedValue(true),
        passwordVerification: jest.fn().mockResolvedValue('ok'),
        updatePassword: jest.fn().mockResolvedValue('<html>ok</html>'),
        update: jest.fn().mockResolvedValue('token'),
        delete: jest.fn().mockResolvedValue(true),
      };
      controller = new UsersController(mockService);
    });

    it('delegates calls correctly', async () => {
      await controller.getAll({ page: 1, pageSize: 10, ascending: true });
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.getById(1);
      expect(mockService.getById).toHaveBeenCalledWith(1);

      await controller.create({ emailUser: 'a', passwordUser: 'b', usernameUser: 'c' } as unknown as UserCreateDto);
      expect(mockService.create).toHaveBeenCalled();

      await controller.verifyEmail('test@b.com', undefined);
      expect(mockService.verifyEmail).toHaveBeenCalledWith('test@b.com');

      await controller.verifyEmail(undefined, 'legacy@b.com');
      expect(mockService.verifyEmail).toHaveBeenCalledWith('legacy@b.com');

      await controller.passwordVerification(undefined, 'mail@b.com');
      expect(mockService.passwordVerification).toHaveBeenCalledWith('mail@b.com');

      await controller.passwordVerification('legacy@b.com', undefined);
      expect(mockService.passwordVerification).toHaveBeenCalledWith('legacy@b.com');

      await controller.updatePassword(1, 'pass', 'pass', undefined);
      expect(mockService.updatePassword).toHaveBeenCalledWith(1, 'pass', 'pass');

      await controller.updatePassword(1, 'pass', 'pass', '5');
      expect(mockService.updatePassword).toHaveBeenCalledWith(5, 'pass', 'pass');

      await controller.update({ idUser: 7 } as unknown as UserUpdateDto, 10);
      expect(mockService.update).toHaveBeenCalledWith(7, { idUser: 7 });

      await controller.update({} as unknown as UserUpdateDto, 10);
      expect(mockService.update).toHaveBeenCalledWith(10, {});

      await expect(controller.update({} as unknown as UserUpdateDto, undefined)).rejects.toThrow(BadRequestException);

      await controller.updateById(3, { usernameUser: 'nick' } as unknown as UserUpdateDto);
      expect(mockService.update).toHaveBeenCalledWith(3, { usernameUser: 'nick' });

      await controller.delete(2);
      expect(mockService.delete).toHaveBeenCalledWith(2);
    });

    it('UsersModule is defined', () => {
      expect(UsersModule).toBeDefined();
      const module = new UsersModule();
      expect(module).toBeInstanceOf(UsersModule);
    });
  });
});
