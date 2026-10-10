import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserGamesService } from '../src/user-games/user-games.service';
import { UserGamesController } from '../src/user-games/user-games.controller';
import { UserGamesModule } from '../src/user-games/user-games.module';
import { UserGamesCreateDto } from '../src/user-games/user-games.dto';
import { DataStore } from '../src/store/data-store';

describe('UserGames module unit tests', () => {
  describe('UserGamesService', () => {
    let mockStore: {
      select: jest.Mock;
      insert: jest.Mock;
      query: jest.Mock;
    };
    let service: UserGamesService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        insert: jest.fn(),
        query: jest.fn(),
      };
      service = new UserGamesService(mockStore as unknown as DataStore);
    });

    it('addGame adds game to user library with custom or current buyDate', async () => {
      mockStore.select.mockResolvedValue([{ IdGame: 10 }]);
      mockStore.insert.mockResolvedValue({ IdUser: 1, IdGame: 10 });

      const res = await service.addGame(1, {
        idGame: 10,
        buyDate: '2026-10-10T12:00:00Z',
      } as unknown as UserGamesCreateDto);

      expect(res).toBe(true);
      expect(mockStore.insert).toHaveBeenCalledWith('UsersGames', {
        IdUser: 1,
        IdGame: 10,
        BuyDate: new Date('2026-10-10T12:00:00Z'),
      });

      // Without buyDate
      await service.addGame(1, { idGame: 10 } as unknown as UserGamesCreateDto);
      expect(mockStore.insert).toHaveBeenCalledWith('UsersGames', expect.objectContaining({
        IdUser: 1,
        IdGame: 10,
        BuyDate: expect.any(Date),
      }));
    });

    it('addGame throws BadRequestException when game id is invalid or game not found', async () => {
      await expect(service.addGame(1, { idGame: 0 } as unknown as UserGamesCreateDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.addGame(1, { idGame: -1 } as unknown as UserGamesCreateDto))
        .rejects.toThrow(BadRequestException);

      mockStore.select.mockResolvedValue([]);
      await expect(service.addGame(1, { idGame: 99 } as unknown as UserGamesCreateDto))
        .rejects.toThrow(BadRequestException);
    });

    it('getUserLibrary returns user and gamesData with genres', async () => {
      mockStore.select.mockResolvedValue([{ IdUser: 1, EmailUser: 'u@test.com' }]);
      mockStore.query
        .mockResolvedValueOnce([
          { IdGame: 5, NameGame: 'Game 5', Price: 20, BuyDate: new Date('2026-01-01') },
        ])
        .mockResolvedValueOnce([
          { IdGenre: 1, NameGenre: 'Action' },
        ]);

      const res = await service.getUserLibrary(1);
      expect(res.user.idUser).toBe(1);
      expect(res.gamesData).toHaveLength(1);
      expect(res.gamesData[0].game.idGame).toBe(5);
      expect(res.gamesData[0].genres).toHaveLength(1);
      expect(res.gamesData[0].genres[0].idGenre).toBe(1);
      expect(res.gamesData[0].buyDate).toEqual(new Date('2026-01-01'));
    });

    it('getUserLibrary throws NotFoundException when user does not exist', async () => {
      mockStore.select.mockResolvedValue([]);
      await expect(service.getUserLibrary(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('UserGamesController', () => {
    let mockService: any;
    let controller: UserGamesController;

    beforeEach(() => {
      mockService = {
        addGame: jest.fn().mockResolvedValue(true),
        getUserLibrary: jest.fn().mockResolvedValue({ user: {}, gamesData: [] }),
      };
      controller = new UserGamesController(mockService);
    });

    it('delegates calls correctly and validates userId', async () => {
      await expect(controller.addGame(undefined, { idGame: 1 } as unknown as UserGamesCreateDto))
        .rejects.toThrow(UnauthorizedException);
      await expect(controller.addGame(-1, { idGame: 1 } as unknown as UserGamesCreateDto))
        .rejects.toThrow(UnauthorizedException);

      const ok = await controller.addGame(5, { idGame: 1 } as unknown as UserGamesCreateDto);
      expect(ok).toBe(true);
      expect(mockService.addGame).toHaveBeenCalledWith(5, { idGame: 1 });

      await controller.getUserLibrary(5);
      expect(mockService.getUserLibrary).toHaveBeenCalledWith(5);
    });

    it('UserGamesModule is defined', () => {
      expect(UserGamesModule).toBeDefined();
      const module = new UserGamesModule();
      expect(module).toBeInstanceOf(UserGamesModule);
    });
  });
});
