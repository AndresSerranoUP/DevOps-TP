import { NotFoundException } from '@nestjs/common';
import { GenresMapper } from '../src/genres/genres.mapper';
import { GenresService } from '../src/genres/genres.service';
import { GenresController } from '../src/genres/genres.controller';
import { GenresModule } from '../src/genres/genres.module';
import { DataStore } from '../src/store/data-store';

describe('Genres module unit tests', () => {
  describe('GenresMapper', () => {
    it('maps row to response with clean camelCase keys', () => {
      const res = GenresMapper.toResponse({ IdGenre: 1, NameGenre: 'Action', Disabled: 0 });
      expect(res.idGenre).toBe(1);
      expect((res as any).IdGenre).toBeUndefined();
      expect(res.nameGenre).toBe('Action');
      expect((res as any).NameGenre).toBeUndefined();
      expect(res.disabled).toBe(0);
      expect((res as any).Disabled).toBeUndefined();
    });

    it('handles defaults when fields are missing', () => {
      const res = GenresMapper.toResponse({});
      expect(res.idGenre).toBeNaN();
      expect(res.nameGenre).toBe('');
      expect(res.disabled).toBe(0);
    });
  });

  describe('GenresService', () => {
    let mockStore: {
      select: jest.Mock;
    };
    let service: GenresService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
      };
      service = new GenresService(mockStore as unknown as DataStore);
    });

    it('getAll selects all genres ordered by IdGenre', async () => {
      mockStore.select.mockResolvedValue([
        { IdGenre: 1, NameGenre: 'Action' },
        { IdGenre: 2, NameGenre: 'Adventure' },
      ]);
      const res = await service.getAll();
      expect(res).toHaveLength(2);
      expect(res[0].idGenre).toBe(1);
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Genres', orderBy: 'IdGenre' });
    });

    it('getById returns single genre or throws NotFoundException', async () => {
      mockStore.select.mockResolvedValue([{ IdGenre: 1, NameGenre: 'Action' }]);
      const res = await service.getById(1);
      expect(res.idGenre).toBe(1);
      expect(res.nameGenre).toBe('Action');
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Genres', where: { IdGenre: 1 } });

      mockStore.select.mockResolvedValue([]);
      await expect(service.getById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GenresController', () => {
    it('delegates calls to service', async () => {
      const mockService = {
        getAll: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue({ idGenre: 1 }),
      };
      const controller = new GenresController(mockService as any);

      await controller.getAll();
      expect(mockService.getAll).toHaveBeenCalled();

      await controller.getById(1);
      expect(mockService.getById).toHaveBeenCalledWith(1);
    });

    it('GenresModule is defined', () => {
      expect(GenresModule).toBeDefined();
      const module = new GenresModule();
      expect(module).toBeInstanceOf(GenresModule);
    });
  });
});
