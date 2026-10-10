import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataStore, Row } from '../store/data-store';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { PageResult } from '../common/pagination/page-result';
import { paginate } from '../common/pagination/paginate';
import {
  GameCreateDto,
  GameUpdateDto,
  GameMinUpdateDto,
  GameCreateResponseDto,
} from './games.dto';
import { AppConfig } from '../config/app-config';
import { GamesMapper, GameResponse } from './games.mapper';

@Injectable()
export class GamesService {
  constructor(
    private readonly dataStore: DataStore,
    private readonly appConfig: AppConfig,
  ) {}

  private async attachGenresAndOwnership(games: Row[], currentUserId?: number): Promise<GameResponse[]> {
    if (games.length === 0) return [];

    const gameIds = games.map(g => Number(g.IdGame));

    const inParams: Record<string, any> = {};
    const placeholders = gameIds.map((id, index) => {
      const pName = `gid_${index}`;
      inParams[pName] = id;
      return `@${pName}`;
    });
    const inSql = placeholders.join(',');

    // Fetch genres using parameterized placeholders
    const genreRows = await this.dataStore.query<any>(
      `SELECT gg.IdGame, g.IdGenre, g.NameGenre
       FROM [GamesGenres] gg
       JOIN [Genres] g ON g.IdGenre = gg.IdGenre
       WHERE gg.IdGame IN (${inSql})`,
      inParams,
    );

    const genresByGame = new Map<number, Array<{ idGenre: number; nameGenre: string }>>();
    for (const r of genreRows) {
      const gId = Number(r.IdGame);
      if (!genresByGame.has(gId)) genresByGame.set(gId, []);
      genresByGame.get(gId)!.push({
        idGenre: Number(r.IdGenre),
        nameGenre: String(r.NameGenre),
      });
    }

    // Fetch ownership if user is logged in using parameterized placeholders
    const ownedGameIds = new Set<number>();
    if (currentUserId && Number.isInteger(currentUserId) && currentUserId > 0) {
      const ugParams: Record<string, any> = { userId: currentUserId, ...inParams };
      const ugRows = await this.dataStore.query<any>(
        `SELECT IdGame FROM [UsersGames] WHERE IdUser = @userId AND IdGame IN (${inSql})`,
        ugParams,
      );
      for (const ug of ugRows) {
        ownedGameIds.add(Number(ug.IdGame));
      }
    }

    return games.map(game => {
      const gId = Number(game.IdGame);
      const gList = genresByGame.get(gId) || [];
      const generoStr = gList.map(g => g.nameGenre).join(', ');
      const isOwned = ownedGameIds.has(gId);

      return GamesMapper.toResponse({
        ...game,
        genero: generoStr,
        genres: gList,
        isOwned,
      });
    });
  }

  async getAll(query: PageQueryDto, currentUserId?: number): Promise<PageResult<GameResponse>> {
    return paginate(
      () => this.dataStore.count({ table: 'Games', where: { Disabled: 0 } }),
      async (offset, limit) => {
        const rows = await this.dataStore.select({
          table: 'Games',
          where: { Disabled: 0 },
          offset,
          limit,
          orderBy: query.orderBy || 'IdGame',
          ascending: query.ascending !== false,
        });
        return this.attachGenresAndOwnership(rows, currentUserId);
      },
      query,
      `${this.appConfig.publicApiUrl}/Game/GetAll`,
    );
  }

  async getById(id: number, currentUserId?: number): Promise<GameResponse> {
    const rows = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    const game = rows[0];
    if (!game || game.Disabled === 1) {
      throw new NotFoundException('Game not found');
    }

    // Calculate ratings
    const ratings = await this.dataStore.select({
      table: 'Ratings',
      where: { IdGame: id },
    });

    let likes = 0;
    let dislikes = 0;
    for (const r of ratings) {
      const val = Number(r.Likes);
      if (val === 1) likes++;
      else if (val === 0 || val === 2 || val === -1) dislikes++;
    }

    // Check ownership
    let isOwned = false;
    let userRate: number | null = null;
    if (currentUserId && Number.isInteger(currentUserId) && currentUserId > 0) {
      const ug = await this.dataStore.select({
        table: 'UsersGames',
        where: { IdUser: currentUserId, IdGame: id },
      });
      isOwned = ug.length > 0;
      if (isOwned) {
        const userRatingRow = ratings.find(r => Number(r.IdUser) === currentUserId);
        if (userRatingRow) {
          userRate = Number(userRatingRow.Likes);
        }
      }
    }

    // Genres
    const genreRows = await this.dataStore.query<any>(
      `SELECT g.IdGenre, g.NameGenre
       FROM [GamesGenres] gg
       JOIN [Genres] g ON g.IdGenre = gg.IdGenre
       WHERE gg.IdGame = @id`,
      { id },
    );
    const generoStr = genreRows.map(g => g.NameGenre).join(', ');

    return GamesMapper.toResponse({
      ...game,
      likes,
      dislikes,
      isOwned,
      userRate,
      genero: generoStr,
      genres: genreRows,
    });
  }

  async rate(gameId: number, userId: number | undefined, likes: number): Promise<string> {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Necesitas estar registrado y tener el juego para opinar');
    }

    const ug = await this.dataStore.select({
      table: 'UsersGames',
      where: { IdUser: userId, IdGame: gameId },
    });
    if (!ug[0]) {
      throw new BadRequestException('Necesitas tener el juego para opinar');
    }

    // Upsert rating
    const existing = await this.dataStore.select({
      table: 'Ratings',
      where: { IdUser: userId, IdGame: gameId },
    });

    if (existing[0]) {
      await this.dataStore.update(
        'Ratings',
        { IdRating: Number(existing[0].IdRating) },
        { Likes: likes },
      );
    } else {
      await this.dataStore.insert('Ratings', {
        IdGame: gameId,
        IdUser: userId,
        Likes: likes,
      });
    }

    return 'Gracias por tu opinion';
  }

  async getTestRatings(): Promise<Row[]> {
    return this.dataStore.select({ table: 'Ratings' });
  }

  async getByGenre(genreId: number): Promise<GameResponse[]> {
    const rows = await this.dataStore.query(
      `SELECT g.* FROM [Games] g
       JOIN [GamesGenres] gg ON gg.IdGame = g.IdGame
       WHERE gg.IdGenre = @id AND g.Disabled = 0`,
      { id: genreId },
    );
    return rows.map(r => GamesMapper.toResponse(r));
  }

  async getByName(name: string): Promise<GameResponse[]> {
    const rows = await this.dataStore.query(
      `SELECT TOP 5 * FROM [Games]
       WHERE [Disabled] = 0 AND [NameGame] LIKE @name
       ORDER BY [IdGame] ASC`,
      { name: `%${name}%` },
    );
    return rows.map(r => GamesMapper.toResponse(r));
  }

  async getByDeveloper(
    idDeveloper: number,
    query: PageQueryDto,
    currentUserId?: number,
  ): Promise<PageResult<GameResponse>> {
    if (!idDeveloper || !Number.isInteger(idDeveloper) || idDeveloper <= 0) {
      throw new BadRequestException({ Error: 'Debe ingrasar el id de un developer' });
    }

    return paginate(
      () =>
        this.dataStore.count({
          table: 'Games',
          where: { Disabled: 0, IdDeveloper: idDeveloper },
        }),
      async (offset, limit) => {
        const rows = await this.dataStore.select({
          table: 'Games',
          where: { Disabled: 0, IdDeveloper: idDeveloper },
          offset,
          limit,
          orderBy: query.orderBy || 'IdGame',
          ascending: query.ascending !== false,
        });
        return this.attachGenresAndOwnership(rows, currentUserId);
      },
      query,
      `${this.appConfig.publicApiUrl}/Game/GetGamesByDeveloper`,
    );
  }

  async create(dto: GameCreateDto): Promise<GameCreateResponseDto> {
    const now = new Date();
    const releaseDate = dto.releaseDate ? new Date(dto.releaseDate) : now;

    const game = await this.dataStore.insert<any>('Games', {
      NameGame: dto.nameGame,
      ReleaseDate: releaseDate,
      IdDeveloper: dto.idDeveloper,
      ImgThumbnail: dto.imgThumbnail ?? null,
      ImgLogo: dto.imgLogo ?? null,
      ImgBackground: dto.imgBackground ?? null,
      Size: dto.size ?? 0,
      Price: dto.price,
      LongDescription: dto.longDescription ?? '',
      ShortDescription: dto.shortDescription ?? '',
      MinRam: dto.minRam ?? '',
      MinGpu: dto.minGpu ?? '',
      MinCpu: dto.minCpu ?? '',
      MinOs: dto.minOs ?? '',
      IdSteam: dto.idSteam ?? null,
      Disabled: 1, // forced disabled 1
    });

    const idGame = Number(game.IdGame);
    const genresIds = dto.genresIds || [];

    for (const gId of genresIds) {
      await this.dataStore.insert('GamesGenres', {
        IdGame: idGame,
        IdGenre: gId,
      });
    }

    return {
      idGame,
      nameGame: String(game.NameGame),
      releaseDate: game.ReleaseDate,
      idDeveloper: Number(game.IdDeveloper),
      price: Number(game.Price),
      disabled: Number(game.Disabled),
      genresIds,
    };
  }

  async update(id: number, dto: GameUpdateDto): Promise<GameResponse> {
    const existing = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    if (!existing[0]) {
      throw new NotFoundException('Game not found');
    }

    const values: Record<string, unknown> = {};
    if (dto.nameGame !== undefined) values.NameGame = dto.nameGame;
    if (dto.releaseDate !== undefined) values.ReleaseDate = new Date(dto.releaseDate);
    if (dto.idDeveloper !== undefined) values.IdDeveloper = dto.idDeveloper;
    if (dto.imgThumbnail !== undefined) values.ImgThumbnail = dto.imgThumbnail;
    if (dto.imgLogo !== undefined) values.ImgLogo = dto.imgLogo;
    if (dto.imgBackground !== undefined) values.ImgBackground = dto.imgBackground;
    if (dto.size !== undefined) values.Size = dto.size;
    if (dto.price !== undefined) values.Price = dto.price;
    if (dto.longDescription !== undefined) values.LongDescription = dto.longDescription;
    if (dto.shortDescription !== undefined) values.ShortDescription = dto.shortDescription;
    if (dto.minRam !== undefined) values.MinRam = dto.minRam;
    if (dto.minGpu !== undefined) values.MinGpu = dto.minGpu;
    if (dto.minCpu !== undefined) values.MinCpu = dto.minCpu;
    if (dto.minOs !== undefined) values.MinOs = dto.minOs;
    if (dto.idSteam !== undefined) values.IdSteam = dto.idSteam;

    await this.dataStore.update('Games', { IdGame: id }, values);

    if (dto.genresIds !== undefined && Array.isArray(dto.genresIds)) {
      await this.dataStore.delete('GamesGenres', { IdGame: id });
      for (const gId of dto.genresIds) {
        await this.dataStore.insert('GamesGenres', {
          IdGame: id,
          IdGenre: gId,
        });
      }
    }

    const updated = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    return GamesMapper.toResponse(updated[0]);
  }

  async minUpdate(id: number, dto: GameMinUpdateDto): Promise<GameResponse> {
    const existing = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    if (!existing[0]) {
      throw new NotFoundException('El juego no fue encontrado!');
    }

    const values: Record<string, unknown> = {};
    const name = dto.nameGame ?? dto.name;
    if (name !== undefined) values.NameGame = name;
    if (dto.price !== undefined) values.Price = dto.price;
    if (dto.disabled !== undefined) {
      values.Disabled = (dto.disabled === true || dto.disabled === 1 || dto.disabled === '1' as any) ? 1 : 0;
    }
    if (dto.imgThumbnail !== undefined) values.ImgThumbnail = dto.imgThumbnail;
    if (dto.imgLogo !== undefined) values.ImgLogo = dto.imgLogo;
    if (dto.imgBackground !== undefined) values.ImgBackground = dto.imgBackground;
    if (dto.minRam !== undefined) values.MinRam = dto.minRam;
    if (dto.minGpu !== undefined) values.MinGpu = dto.minGpu;
    if (dto.minCpu !== undefined) values.MinCpu = dto.minCpu;
    if (dto.minOs !== undefined) values.MinOs = dto.minOs;

    await this.dataStore.update('Games', { IdGame: id }, values);
    const updated = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    return GamesMapper.toResponse(updated[0]);
  }

  async delete(id: number): Promise<boolean> {
    const existing = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: id },
    });
    if (!existing[0]) {
      throw new NotFoundException('Game not found');
    }
    await this.dataStore.update('Games', { IdGame: id }, { Disabled: 1 });
    return true;
  }
}
