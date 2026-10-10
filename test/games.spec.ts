import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GamesMapper } from '../src/games/games.mapper';
import { GamesService } from '../src/games/games.service';
import { GamesController } from '../src/games/games.controller';
import { GamesModule } from '../src/games/games.module';
import {
  GameCreateDto,
  GameUpdateDto,
  GameMinUpdateDto,
  RateDto,
} from '../src/games/games.dto';
import { PageQueryDto } from '../src/common/pagination/page-query.dto';
import { AppConfig } from '../src/config/app-config';
import { ConfigService } from '@nestjs/config';
import { DataStore } from '../src/store/data-store';

describe('Games module unit tests', () => {
  const appConfig = new AppConfig(new ConfigService({
    PUBLIC_API_URL: 'http://api.test',
  }));

  describe('GamesMapper', () => {
    it('maps DB row to GameResponse with clean camelCase keys', () => {
      const row = {
        IdGame: 1,
        NameGame: 'Elden Ring',
        ReleaseDate: new Date('2022-02-25'),
        IdDeveloper: 10,
        ImgThumbnail: 'thumb.jpg',
        ImgLogo: 'logo.png',
        ImgBackground: 'bg.jpg',
        Size: 60,
        Price: 59.99,
        LongDescription: 'Long description',
        ShortDescription: 'Short description',
        MinRam: '12GB',
        MinGpu: 'GTX 1060',
        MinCpu: 'i5-8400',
        MinOs: 'Windows 10',
        IdSteam: 1245620,
        Disabled: 0,
        likes: 10,
        dislikes: 1,
        isOwned: true,
        userRate: 1,
        genero: 'Action, RPG',
        genres: [{ idGenre: 1, nameGenre: 'Action' }],
        genresIds: [1, 2],
      };

      const res = GamesMapper.toResponse(row);
      expect(res.idGame).toBe(1);
      expect((res as any).IdGame).toBeUndefined();
      expect(res.nameGame).toBe('Elden Ring');
      expect((res as any).NameGame).toBeUndefined();
      expect(res.idDeveloper).toBe(10);
      expect(res.price).toBe(59.99);
      expect(res.size).toBe(60);
      expect(res.idSteam).toBe(1245620);
      expect(res.likes).toBe(10);
      expect((res as any).Likes).toBeUndefined();
      expect(res.dislikes).toBe(1);
      expect((res as any).Dislikes).toBeUndefined();
      expect(res.isOwned).toBe(true);
      expect((res as any).IsOwned).toBeUndefined();
      expect(res.userRate).toBe(1);
      expect((res as any).UserRate).toBeUndefined();
      expect(res.genero).toBe('Action, RPG');
      expect((res as any).Genero).toBeUndefined();
      expect(res.genres).toHaveLength(1);
      expect(res.genresIds).toEqual([1, 2]);
    });

    it('handles minimal fields with defaults', () => {
      const res = GamesMapper.toResponse({ IdGame: 2, IdDeveloper: 1 });
      expect(res.idGame).toBe(2);
      expect(res.nameGame).toBe('');
      expect(res.releaseDate).toBeNull();
      expect(res.imgThumbnail).toBeNull();
      expect(res.size).toBeNull();
      expect(res.price).toBe(0);
      expect(res.idSteam).toBeNull();
      expect(res.disabled).toBe(0);
      expect(res.likes).toBeUndefined();
      expect(res.isOwned).toBeUndefined();
    });
  });

  describe('GamesService', () => {
    let mockStore: {
      select: jest.Mock;
      count: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      query: jest.Mock;
    };
    let service: GamesService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        count: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
      };
      service = new GamesService(mockStore as unknown as DataStore, appConfig);
    });

    it('getAll returns paginated games with attached genres and ownership', async () => {
      mockStore.count.mockResolvedValue(1);
      mockStore.select.mockResolvedValue([{ IdGame: 10, NameGame: 'Game 10', Disabled: 0 }]);
      mockStore.query
        .mockResolvedValueOnce([{ IdGame: 10, IdGenre: 1, NameGenre: 'Action' }]) // genres
        .mockResolvedValueOnce([{ IdGame: 10 }]); // ownership

      const res = await service.getAll({ page: 1, pageSize: 12 } as unknown as PageQueryDto, 5);
      expect(res.pageNumber).toBe(1);
      expect(res.results).toHaveLength(1);
      expect(res.results[0].idGame).toBe(10);
      expect(res.results[0].genero).toBe('Action');
      expect(res.results[0].isOwned).toBe(true);

      // Anonymous call when games list is empty
      mockStore.count.mockResolvedValue(0);
      mockStore.select.mockResolvedValue([]);
      const emptyRes = await service.getAll({ page: 1, pageSize: 12 } as unknown as PageQueryDto);
      expect(emptyRes.results).toHaveLength(0);
    });

    it('getById returns game with ratings and ownership, or throws NotFoundException if disabled', async () => {
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 1, NameGame: 'Game', Disabled: 0 }]) // game
        .mockResolvedValueOnce([
          { IdRating: 1, IdGame: 1, IdUser: 2, Likes: 1 },
          { IdRating: 2, IdGame: 1, IdUser: 3, Likes: 0 },
          { IdRating: 3, IdGame: 1, IdUser: 4, Likes: 2 },
          { IdRating: 4, IdGame: 1, IdUser: 5, Likes: -1 },
        ]) // ratings
        .mockResolvedValueOnce([{ IdUser: 2, IdGame: 1 }]); // ownership
      mockStore.query.mockResolvedValue([{ IdGenre: 1, NameGenre: 'Adventure' }]);

      const res = await service.getById(1, 2);
      expect(res.idGame).toBe(1);
      expect(res.likes).toBe(1);
      expect(res.dislikes).toBe(3); // 0, 2, and -1 count as dislikes
      expect(res.isOwned).toBe(true);
      expect(res.userRate).toBe(1);
      expect(res.genero).toBe('Adventure');

      // Not found or disabled game
      mockStore.select.mockResolvedValueOnce([{ IdGame: 2, Disabled: 1 }]);
      await expect(service.getById(2)).rejects.toThrow(NotFoundException);

      mockStore.select.mockResolvedValueOnce([]);
      await expect(service.getById(99)).rejects.toThrow(NotFoundException);
    });

    it('rate allows user who owns the game to submit a rating and handles upsert', async () => {
      // First rating (insert)
      mockStore.select
        .mockResolvedValueOnce([{ IdUser: 7, IdGame: 1 }]) // owns game
        .mockResolvedValueOnce([]); // no existing rating

      const msg1 = await service.rate(1, 7, 1);
      expect(msg1).toBe('Gracias por tu opinion');
      expect(mockStore.insert).toHaveBeenCalledWith('Ratings', {
        IdGame: 1,
        IdUser: 7,
        Likes: 1,
      });

      // Update existing rating
      mockStore.select
        .mockResolvedValueOnce([{ IdUser: 7, IdGame: 1 }]) // owns game
        .mockResolvedValueOnce([{ IdRating: 99, IdUser: 7, IdGame: 1, Likes: 1 }]); // existing rating

      const msg2 = await service.rate(1, 7, 0);
      expect(msg2).toBe('Gracias por tu opinion');
      expect(mockStore.update).toHaveBeenCalledWith('Ratings', { IdRating: 99 }, { Likes: 0 });
    });

    it('rate throws BadRequestException when user is invalid or does not own the game', async () => {
      await expect(service.rate(1, undefined, 1)).rejects.toThrow('Necesitas estar registrado y tener el juego para opinar');
      await expect(service.rate(1, -1, 1)).rejects.toThrow('Necesitas estar registrado y tener el juego para opinar');

      mockStore.select.mockResolvedValueOnce([]); // user does not own game
      await expect(service.rate(1, 7, 1)).rejects.toThrow('Necesitas tener el juego para opinar');
    });

    it('getTestRatings selects all rows from Ratings table', async () => {
      mockStore.select.mockResolvedValue([{ IdRating: 1 }]);
      const res = await service.getTestRatings();
      expect(res).toEqual([{ IdRating: 1 }]);
      expect(mockStore.select).toHaveBeenCalledWith({ table: 'Ratings' });
    });

    it('getByGenre queries games by genre id', async () => {
      mockStore.query.mockResolvedValue([{ IdGame: 1, NameGame: 'Shooter' }]);
      const res = await service.getByGenre(2);
      expect(res).toHaveLength(1);
      expect(res[0].nameGame).toBe('Shooter');
    });

    it('getByName queries top 5 games matching name', async () => {
      mockStore.query.mockResolvedValue([{ IdGame: 3, NameGame: 'Witcher 3' }]);
      const res = await service.getByName('Witcher');
      expect(res).toHaveLength(1);
      expect(res[0].nameGame).toBe('Witcher 3');
    });

    it('getByDeveloper returns paginated games by developer or throws BadRequestException on invalid developer id', async () => {
      mockStore.count.mockResolvedValue(1);
      mockStore.select.mockResolvedValue([{ IdGame: 5, NameGame: 'Game 5', Disabled: 0 }]);
      mockStore.query.mockResolvedValue([]);

      const res = await service.getByDeveloper(3, { page: 1, pageSize: 10 } as unknown as PageQueryDto);
      expect(res.pageNumber).toBe(1);
      expect(res.results).toHaveLength(1);

      await expect(service.getByDeveloper(0, {} as unknown as PageQueryDto)).rejects.toThrow(BadRequestException);
      await expect(service.getByDeveloper(-1, {} as unknown as PageQueryDto)).rejects.toThrow(BadRequestException);
    });

    it('create inserts game with Disabled: 1 and links genres in GamesGenres', async () => {
      mockStore.insert
        .mockResolvedValueOnce({
          IdGame: 42,
          NameGame: 'New Game',
          ReleaseDate: new Date(),
          IdDeveloper: 5,
          Price: 29.99,
          Disabled: 1,
        })
        .mockResolvedValue({ IdGame: 42, IdGenre: 1 });

      const dto = {
        nameGame: 'New Game',
        idDeveloper: 5,
        price: 29.99,
        genresIds: [1, 2],
      } as unknown as GameCreateDto;

      const res = await service.create(dto);
      expect(res.idGame).toBe(42);
      expect(res.disabled).toBe(1);
      expect(res.genresIds).toEqual([1, 2]);
      expect(mockStore.insert).toHaveBeenCalledWith('Games', expect.objectContaining({
        NameGame: 'New Game',
        Disabled: 1,
      }));
      expect(mockStore.insert).toHaveBeenCalledWith('GamesGenres', { IdGame: 42, IdGenre: 1 });
      expect(mockStore.insert).toHaveBeenCalledWith('GamesGenres', { IdGame: 42, IdGenre: 2 });
    });

    it('update modifies game and replaces genre associations', async () => {
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 10 }])
        .mockResolvedValueOnce([{ IdGame: 10, NameGame: 'Updated Game' }]);
      mockStore.update.mockResolvedValue([{ IdGame: 10 }]);
      mockStore.delete.mockResolvedValue(2);

      const dto = {
        nameGame: 'Updated Game',
        price: 19.99,
        genresIds: [3],
      } as unknown as GameUpdateDto;

      const res = await service.update(10, dto);
      expect(res.nameGame).toBe('Updated Game');
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 10 }, expect.objectContaining({
        NameGame: 'Updated Game',
        Price: 19.99,
      }));
      expect(mockStore.delete).toHaveBeenCalledWith('GamesGenres', { IdGame: 10 });
      expect(mockStore.insert).toHaveBeenCalledWith('GamesGenres', { IdGame: 10, IdGenre: 3 });

      // Not found
      mockStore.select.mockResolvedValueOnce([]);
      await expect(service.update(99, {} as unknown as GameUpdateDto)).rejects.toThrow(NotFoundException);
    });

    it('minUpdate modifies minimal game properties and converts disabled value', async () => {
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 7 }])
        .mockResolvedValueOnce([{ IdGame: 7, NameGame: 'Patched Game', Disabled: 0 }]);
      mockStore.update.mockResolvedValue([{ IdGame: 7 }]);

      const dto = {
        name: 'Patched Game',
        price: 9.99,
        disabled: false,
      } as unknown as GameMinUpdateDto;

      const res = await service.minUpdate(7, dto);
      expect(res.nameGame).toBe('Patched Game');
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 7 }, expect.objectContaining({
        NameGame: 'Patched Game',
        Price: 9.99,
        Disabled: 0,
      }));

      // Test disabled truthy conversion
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 7 }])
        .mockResolvedValueOnce([{ IdGame: 7, Disabled: 1 }]);
      await service.minUpdate(7, { disabled: 1 } as unknown as GameMinUpdateDto);
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 7 }, expect.objectContaining({
        Disabled: 1,
      }));

      // Not found
      mockStore.select.mockResolvedValueOnce([]);
      await expect(service.minUpdate(99, {} as unknown as GameMinUpdateDto)).rejects.toThrow('El juego no fue encontrado!');
    });

    it('delete marks game Disabled: 1 or throws NotFoundException if not found', async () => {
      mockStore.select.mockResolvedValueOnce([{ IdGame: 1 }]);
      mockStore.update.mockResolvedValue([{ IdGame: 1, Disabled: 1 }]);

      expect(await service.delete(1)).toBe(true);
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 1 }, { Disabled: 1 });

      mockStore.select.mockResolvedValueOnce([]);
      await expect(service.delete(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GamesController', () => {
    let mockService: any;
    let controller: GamesController;

    beforeEach(() => {
      mockService = {
        getAll: jest.fn().mockResolvedValue({ results: [] }),
        getById: jest.fn().mockResolvedValue({ idGame: 1 }),
        rate: jest.fn().mockResolvedValue('ok'),
        getTestRatings: jest.fn().mockResolvedValue([]),
        getByGenre: jest.fn().mockResolvedValue([]),
        getByName: jest.fn().mockResolvedValue([]),
        getByDeveloper: jest.fn().mockResolvedValue({ results: [] }),
        create: jest.fn().mockResolvedValue({ idGame: 1 }),
        update: jest.fn().mockResolvedValue({ idGame: 1 }),
        minUpdate: jest.fn().mockResolvedValue({ idGame: 1 }),
        delete: jest.fn().mockResolvedValue(true),
      };
      controller = new GamesController(mockService);
    });

    it('delegates calls correctly', async () => {
      await controller.getAll({ page: 1 } as unknown as PageQueryDto, 1);
      expect(mockService.getAll).toHaveBeenCalledWith({ page: 1 }, 1);

      await controller.getById(1, 2);
      expect(mockService.getById).toHaveBeenCalledWith(1, 2);

      await controller.rate(1, { likes: 1 } as unknown as RateDto, 3);
      expect(mockService.rate).toHaveBeenCalledWith(1, 3, 1);

      await controller.test();
      expect(mockService.getTestRatings).toHaveBeenCalled();

      await controller.getByGenre(2);
      expect(mockService.getByGenre).toHaveBeenCalledWith(2);

      await controller.getByName('test');
      expect(mockService.getByName).toHaveBeenCalledWith('test');

      await controller.getByDeveloper('5', undefined, {} as unknown as PageQueryDto, 1);
      expect(mockService.getByDeveloper).toHaveBeenCalledWith(5, {}, 1);

      await controller.getByDeveloper(undefined, '6', {} as unknown as PageQueryDto, 1);
      expect(mockService.getByDeveloper).toHaveBeenCalledWith(6, {}, 1);

      await expect(controller.getByDeveloper(undefined, undefined, {} as unknown as PageQueryDto)).rejects.toThrow(BadRequestException);
      await expect(controller.getByDeveloper('invalid', undefined, {} as unknown as PageQueryDto)).rejects.toThrow(BadRequestException);
      await expect(controller.getByDeveloper('-5', undefined, {} as unknown as PageQueryDto)).rejects.toThrow(BadRequestException);

      await controller.create({ nameGame: 'test' } as unknown as GameCreateDto);
      expect(mockService.create).toHaveBeenCalled();

      await controller.updateLegacy({ idGame: 10, nameGame: 'test' } as unknown as GameUpdateDto);
      expect(mockService.update).toHaveBeenCalledWith(10, { idGame: 10, nameGame: 'test' });

      await expect(controller.updateLegacy({} as unknown as GameUpdateDto)).rejects.toThrow(BadRequestException);

      await controller.update(10, { nameGame: 'test' } as unknown as GameUpdateDto);
      expect(mockService.update).toHaveBeenCalledWith(10, { nameGame: 'test' });

      await controller.minUpdate(10, { name: 'test' } as unknown as GameMinUpdateDto);
      expect(mockService.minUpdate).toHaveBeenCalledWith(10, { name: 'test' });

      await controller.delete(10);
      expect(mockService.delete).toHaveBeenCalledWith(10);
    });

    it('GamesModule is defined', () => {
      expect(GamesModule).toBeDefined();
      const module = new GamesModule();
      expect(module).toBeInstanceOf(GamesModule);
    });
  });
});
