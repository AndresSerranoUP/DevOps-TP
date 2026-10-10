import { BadRequestException, ConflictException } from '@nestjs/common';
import { DeveloperUsersMapper } from '../src/developer-users/developer-users.mapper';
import { DeveloperUsersService } from '../src/developer-users/developer-users.service';
import { DeveloperUsersController } from '../src/developer-users/developer-users.controller';
import { DeveloperUsersModule } from '../src/developer-users/developer-users.module';
import { DeveloperUserCreateDto } from '../src/developer-users/developer-users.dto';
import { DataStore, DuplicateKeyError, ForeignKeyError } from '../src/store/data-store';

describe('DeveloperUsers module unit tests', () => {
  describe('DeveloperUsersMapper', () => {
    it('maps row with clean camelCase keys', () => {
      const res = DeveloperUsersMapper.toResponse({
        IdUser: 1,
        IdDeveloper: 2,
        Rango: 0,
      });
      expect(res.idUser).toBe(1);
      expect((res as any).IdUser).toBeUndefined();
      expect(res.idDeveloper).toBe(2);
      expect((res as any).IdDeveloper).toBeUndefined();
      expect(res.rango).toBe(0);
      expect((res as any).Rango).toBeUndefined();
    });

    it('handles fallback defaults', () => {
      const res = DeveloperUsersMapper.toResponse({});
      expect(res.idUser).toBeNaN();
      expect(res.idDeveloper).toBeNaN();
      expect(res.rango).toBe(0);
    });
  });

  describe('DeveloperUsersService', () => {
    let mockStore: {
      select: jest.Mock;
      insert: jest.Mock;
    };
    let service: DeveloperUsersService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        insert: jest.fn(),
      };
      service = new DeveloperUsersService(mockStore as unknown as DataStore);
    });

    it('getAll returns list of developer users', async () => {
      mockStore.select.mockResolvedValue([{ IdUser: 1, IdDeveloper: 2, Rango: 1 }]);
      const res = await service.getAll();
      expect(res).toHaveLength(1);
      expect(res[0].idUser).toBe(1);
      expect(res[0].idDeveloper).toBe(2);
      expect(res[0].rango).toBe(1);
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'DevelopersUsers' });
    });

    it('create inserts new association', async () => {
      mockStore.insert.mockResolvedValue({ IdUser: 5, IdDeveloper: 10, Rango: 0 });
      const res = await service.create({ idUser: 5, idDeveloper: 10, rango: 0 } as unknown as DeveloperUserCreateDto);
      expect(res.idUser).toBe(5);
      expect(res.idDeveloper).toBe(10);
      expect(mockStore.insert).toHaveBeenCalledWith('DevelopersUsers', {
        IdUser: 5,
        IdDeveloper: 10,
        Rango: 0,
      });
    });

    it('create maps DuplicateKeyError to ConflictException', async () => {
      mockStore.insert.mockRejectedValue(new DuplicateKeyError('Duplicate PK'));
      await expect(service.create({ idUser: 5, idDeveloper: 10 } as unknown as DeveloperUserCreateDto))
        .rejects.toThrow(ConflictException);
    });

    it('create maps ForeignKeyError to BadRequestException', async () => {
      mockStore.insert.mockRejectedValue(new ForeignKeyError('FK missing'));
      await expect(service.create({ idUser: 5, idDeveloper: 10 } as unknown as DeveloperUserCreateDto))
        .rejects.toThrow(BadRequestException);
    });

    it('create rethrows unknown errors', async () => {
      mockStore.insert.mockRejectedValue(new Error('Network error'));
      await expect(service.create({ idUser: 5, idDeveloper: 10 } as unknown as DeveloperUserCreateDto))
        .rejects.toThrow('Network error');
    });
  });

  describe('DeveloperUsersController', () => {
    let mockService: any;
    let controller: DeveloperUsersController;

    beforeEach(() => {
      mockService = {
        getAll: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ idUser: 1, idDeveloper: 2 }),
      };
      controller = new DeveloperUsersController(mockService);
    });

    it('delegates calls correctly', async () => {
      await controller.getAll();
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.create({ idUser: 1, idDeveloper: 2 } as unknown as DeveloperUserCreateDto);
      expect(mockService.create).toHaveBeenCalledWith({ idUser: 1, idDeveloper: 2 });
    });

    it('DeveloperUsersModule is defined', () => {
      expect(DeveloperUsersModule).toBeDefined();
      const module = new DeveloperUsersModule();
      expect(module).toBeInstanceOf(DeveloperUsersModule);
    });
  });
});
