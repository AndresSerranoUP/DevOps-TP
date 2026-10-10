import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DevelopersMapper } from '../src/developers/developers.mapper';
import { DevelopersService } from '../src/developers/developers.service';
import { DevelopersController } from '../src/developers/developers.controller';
import { DevelopersModule } from '../src/developers/developers.module';
import { DeveloperCreateDto, DeveloperUpdateDto } from '../src/developers/developers.dto';
import { AppConfig } from '../src/config/app-config';
import { ConfigService } from '@nestjs/config';
import { DataStore } from '../src/store/data-store';

describe('Developers module unit tests', () => {
  const appConfig = new AppConfig(new ConfigService({
    PUBLIC_API_URL: 'http://api.test',
  }));

  describe('DevelopersMapper', () => {
    it('maps DB row to response with clean camelCase keys', () => {
      const row = {
        IdDeveloper: 5,
        NameDeveloper: 'Valve',
        LogoDeveloper: 'valve.png',
        LongDescription: 'Long description',
        ShortDescription: 'Short description',
        Disabled: 0,
      };
      const res = DevelopersMapper.toResponse(row);
      expect(res.idDeveloper).toBe(5);
      expect((res as any).IdDeveloper).toBeUndefined();
      expect(res.nameDeveloper).toBe('Valve');
      expect((res as any).NameDeveloper).toBeUndefined();
      expect(res.logoDeveloper).toBe('valve.png');
      expect((res as any).LogoDeveloper).toBeUndefined();
      expect(res.longDescription).toBe('Long description');
      expect((res as any).LongDescription).toBeUndefined();
      expect(res.shortDescription).toBe('Short description');
      expect((res as any).ShortDescription).toBeUndefined();
      expect(res.disabled).toBe(0);
      expect((res as any).Disabled).toBeUndefined();
    });

    it('handles undefined optional values gracefully', () => {
      const res = DevelopersMapper.toResponse({ IdDeveloper: 1 });
      expect(res.nameDeveloper).toBe('');
      expect(res.logoDeveloper).toBeNull();
      expect(res.longDescription).toBeNull();
      expect(res.shortDescription).toBeNull();
      expect(res.disabled).toBe(0);
    });
  });

  describe('DevelopersService', () => {
    let mockStore: {
      select: jest.Mock;
      count: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
      query: jest.Mock;
    };
    let service: DevelopersService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        count: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        query: jest.fn(),
      };
      service = new DevelopersService(mockStore as unknown as DataStore, appConfig);
    });

    it('getAll returns paginated developer list', async () => {
      mockStore.count.mockResolvedValue(1);
      mockStore.select.mockResolvedValue([{ IdDeveloper: 1, NameDeveloper: 'Dev' }]);

      const res = await service.getAll({ page: 1, pageSize: 10, ascending: true });
      expect(res.pageNumber).toBe(1);
      expect(res.results).toHaveLength(1);
      expect(res.results[0].idDeveloper).toBe(1);
      expect(mockStore.count).toHaveBeenCalledWith({ table: 'Developers' });
    });

    it('getById returns mapped developer or throws NotFoundException', async () => {
      mockStore.select.mockResolvedValue([{ IdDeveloper: 3, NameDeveloper: 'Studio' }]);
      const res = await service.getById(3);
      expect(res.idDeveloper).toBe(3);
      expect(res.nameDeveloper).toBe('Studio');

      mockStore.select.mockResolvedValue([]);
      await expect(service.getById(99)).rejects.toThrow(NotFoundException);
    });

    it('getByName searches developers using LIKE query', async () => {
      mockStore.query.mockResolvedValue([{ IdDeveloper: 2, NameDeveloper: 'Nintendo' }]);
      const res = await service.getByName('Nin');
      expect(res).toHaveLength(1);
      expect(res[0].nameDeveloper).toBe('Nintendo');
      expect(mockStore.query).toHaveBeenCalledWith(
        'SELECT * FROM [Developers] WHERE [NameDeveloper] LIKE @name',
        { name: '%Nin%' },
      );
    });

    it('create inserts new developer with Disabled 0', async () => {
      mockStore.insert.mockResolvedValue({
        IdDeveloper: 10,
        NameDeveloper: 'Capcom',
        LogoDeveloper: 'logo.png',
        LongDescription: 'long',
        ShortDescription: 'short',
        Disabled: 0,
      });

      const res = await service.create({
        nameDeveloper: 'Capcom',
        logoDeveloper: 'logo.png',
        longDescription: 'long',
        shortDescription: 'short',
      } as unknown as DeveloperCreateDto);

      expect(res.idDeveloper).toBe(10);
      expect(res.nameDeveloper).toBe('Capcom');
      expect(mockStore.insert).toHaveBeenCalledWith('Developers', expect.objectContaining({
        NameDeveloper: 'Capcom',
        Disabled: 0,
      }));
    });

    it('update updates developer fields or throws NotFoundException if not found', async () => {
      mockStore.select.mockResolvedValue([{ IdDeveloper: 5, NameDeveloper: 'Old' }]);
      mockStore.update.mockResolvedValue([{ IdDeveloper: 5, NameDeveloper: 'New' }]);

      const res = await service.update(5, {
        nameDeveloper: 'New',
        logoDeveloper: 'new.png',
        longDescription: 'new long',
        shortDescription: 'new short',
      } as unknown as DeveloperUpdateDto);

      expect(res.nameDeveloper).toBe('New');
      expect(mockStore.update).toHaveBeenCalledWith('Developers', { IdDeveloper: 5 }, expect.objectContaining({
        NameDeveloper: 'New',
      }));

      // Fallback when update returns empty array
      mockStore.update.mockResolvedValue([]);
      mockStore.select.mockResolvedValue([{ IdDeveloper: 5, NameDeveloper: 'Refetched' }]);
      const res2 = await service.update(5, { nameDeveloper: 'Refetched' } as unknown as DeveloperUpdateDto);
      expect(res2.nameDeveloper).toBe('Refetched');

      // Not found
      mockStore.select.mockResolvedValue([]);
      await expect(service.update(99, {} as unknown as DeveloperUpdateDto)).rejects.toThrow(NotFoundException);
    });

    it('delete sets Disabled: 1 or throws NotFoundException if not found', async () => {
      mockStore.select.mockResolvedValue([{ IdDeveloper: 1 }]);
      mockStore.update.mockResolvedValue([{ IdDeveloper: 1, Disabled: 1 }]);

      expect(await service.delete(1)).toBe(true);
      expect(mockStore.update).toHaveBeenCalledWith('Developers', { IdDeveloper: 1 }, { Disabled: 1 });

      mockStore.select.mockResolvedValue([]);
      await expect(service.delete(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('DevelopersController', () => {
    let mockService: any;
    let controller: DevelopersController;

    beforeEach(() => {
      mockService = {
        getAll: jest.fn().mockResolvedValue({ results: [] }),
        getById: jest.fn().mockResolvedValue({ idDeveloper: 1 }),
        getByName: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ idDeveloper: 1 }),
        update: jest.fn().mockResolvedValue({ idDeveloper: 1 }),
        delete: jest.fn().mockResolvedValue(true),
      };
      controller = new DevelopersController(mockService);
    });

    it('delegates calls correctly', async () => {
      await controller.getAll({ page: 1, pageSize: 10, ascending: true });
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.getById(1);
      expect(mockService.getById).toHaveBeenCalledWith(1);

      await controller.getByName('test');
      expect(mockService.getByName).toHaveBeenCalledWith('test');

      await controller.create({ nameDeveloper: 'test' } as unknown as DeveloperCreateDto);
      expect(mockService.create).toHaveBeenCalled();

      await controller.updateLegacy({ idDeveloper: 4, nameDeveloper: 'test' } as unknown as DeveloperUpdateDto);
      expect(mockService.update).toHaveBeenCalledWith(4, { idDeveloper: 4, nameDeveloper: 'test' });

      await expect(controller.updateLegacy({} as unknown as DeveloperUpdateDto)).rejects.toThrow(BadRequestException);

      await controller.update(5, { nameDeveloper: 'test' } as unknown as DeveloperUpdateDto);
      expect(mockService.update).toHaveBeenCalledWith(5, { nameDeveloper: 'test' });

      await controller.delete(5);
      expect(mockService.delete).toHaveBeenCalledWith(5);
    });

    it('DevelopersModule is defined', () => {
      expect(DevelopersModule).toBeDefined();
      const module = new DevelopersModule();
      expect(module).toBeInstanceOf(DevelopersModule);
    });
  });
});
