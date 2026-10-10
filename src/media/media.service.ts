import { Injectable, BadRequestException } from '@nestjs/common';
import { DataStore, Row } from '../store/data-store';
import { MediaCreateDto } from './media.dto';
import { MEDIA_TYPES } from '../common/enums';
import { MediaMapper, MediaResponse } from './media.mapper';

@Injectable()
export class MediaService {
  constructor(private readonly dataStore: DataStore) {}

  async getScreenshotsByGame(gameId: number): Promise<MediaResponse[]> {
    const rows = await this.dataStore.query(
      'SELECT m.* FROM [Media] m WHERE m.IdGame = @id AND m.IdMediaType = @type',
      { id: gameId, type: MEDIA_TYPES.Screenshot },
    );
    return rows.map(r => MediaMapper.toResponse(r));
  }

  async getRandomFeatured(): Promise<MediaResponse[]> {
    const rows = await this.dataStore.query(
      `SELECT TOP 6 m.*, g.NameGame, g.Price
       FROM [Media] m
       JOIN [Games] g ON g.IdGame = m.IdGame
       WHERE m.IdMediaType = @type AND g.Disabled = 0
       ORDER BY NEWID()`,
      { type: MEDIA_TYPES.Featured },
    );
    return rows.map(r => MediaMapper.toResponse(r));
  }

  async getMediaByGame(gameId: number): Promise<MediaResponse[]> {
    const rows = await this.dataStore.query(
      `SELECT m.*, mt.MediaTypeName
       FROM [Media] m
       JOIN [MediaType] mt ON mt.IdMediaType = m.IdMediaType
       WHERE m.IdGame = @id AND m.IdMediaType != @screenshotType`,
      { id: gameId, screenshotType: MEDIA_TYPES.Screenshot },
    );
    return rows.map(r => MediaMapper.toResponse(r));
  }

  async createMedia(dto: MediaCreateDto): Promise<MediaResponse> {
    const game = await this.dataStore.select({
      table: 'Games',
      where: { IdGame: dto.idGame },
    });
    if (!game[0]) {
      throw new BadRequestException('Game not found');
    }

    let result: Row;

    if (dto.idMediaType !== MEDIA_TYPES.Screenshot) {
      // Replace existing media for this game and type
      const existing = await this.dataStore.select({
        table: 'Media',
        where: { IdGame: dto.idGame, IdMediaType: dto.idMediaType },
      });

      if (existing[0]) {
        const updated = await this.dataStore.update(
          'Media',
          { IdMedia: Number(existing[0].IdMedia) },
          { Url: dto.url },
        );
        result = updated[0];
      } else {
        result = await this.dataStore.insert('Media', {
          IdGame: dto.idGame,
          IdMediaType: dto.idMediaType,
          Url: dto.url,
        });
      }
    } else {
      result = await this.dataStore.insert('Media', {
        IdGame: dto.idGame,
        IdMediaType: dto.idMediaType,
        Url: dto.url,
      });
    }

    // If Featured (MediaType 2), update Game.ImgThumbnail
    if (dto.idMediaType === MEDIA_TYPES.Featured) {
      await this.dataStore.update(
        'Games',
        { IdGame: dto.idGame },
        { ImgThumbnail: dto.url },
      );
    }

    return MediaMapper.toResponse(result);
  }
}
