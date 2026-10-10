import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataStore, Row } from '../store/data-store';
import { UserGamesCreateDto } from './user-games.dto';
import { UsersMapper } from '../users/users.mapper';
import { GamesMapper, GameResponse } from '../games/games.mapper';
import { GenresMapper, GenreResponse } from '../genres/genres.mapper';

export interface UserLibraryGameData {
  game: GameResponse | Row;
  genres: (GenreResponse | Row)[];
  buyDate: Date | string | null;
}

export interface UserLibraryResponse {
  user: Row;
  gamesData: UserLibraryGameData[];
}

@Injectable()
export class UserGamesService {
  constructor(private readonly dataStore: DataStore) {}

  async addGame(userId: number, dto: UserGamesCreateDto): Promise<boolean> {
    if (!dto.idGame || dto.idGame <= 0) {
      throw new BadRequestException('Invalid game id');
    }

    const game = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: dto.idGame },
    });
    if (!game[0]) {
      throw new BadRequestException('Game not found');
    }

    const buyDate = dto.buyDate ? new Date(dto.buyDate) : new Date();

    await this.dataStore.insert('UsersGames', {
      IdUser: userId,
      IdGame: dto.idGame,
      BuyDate: buyDate,
    });
    return true;
  }

  async getUserLibrary(userId: number): Promise<UserLibraryResponse> {
    const userRows = await this.dataStore.select({
      table: 'Users',
      where: { IdUser: userId },
    });
    if (!userRows[0]) {
      throw new NotFoundException('User was not found');
    }
    const user = UsersMapper.toResponse(userRows[0]);

    const ugRows = await this.dataStore.query<any>(
      `SELECT ug.BuyDate, g.*
       FROM [UsersGames] ug
       JOIN [Games] g ON g.IdGame = ug.IdGame
       WHERE ug.IdUser = @userId`,
      { userId },
    );

    const gamesData: UserLibraryGameData[] = [];

    for (const row of ugRows) {
      const gId = Number(row.IdGame);
      const genreRows = await this.dataStore.query<any>(
        `SELECT g.IdGenre, g.NameGenre
         FROM [GamesGenres] gg
         JOIN [Genres] g ON g.IdGenre = gg.IdGenre
         WHERE gg.IdGame = @id`,
        { id: gId },
      );

      const { BuyDate: buyDate, ...game } = row;

      gamesData.push({
        game: GamesMapper.toResponse(game),
        genres: genreRows.map(g => GenresMapper.toResponse(g)),
        buyDate: buyDate ?? null,
      });
    }

    return {
      user,
      gamesData,
    };
  }
}
