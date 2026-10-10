import { BadRequestException } from '@nestjs/common';
import { MediaMapper } from '../src/media/media.mapper';
import { MediaService } from '../src/media/media.service';
import { MediaController } from '../src/media/media.controller';
import { MediaModule } from '../src/media/media.module';
import { MediaCreateDto } from '../src/media/media.dto';
import { MEDIA_TYPES } from '../src/common/enums';
import { DataStore } from '../src/store/data-store';

describe('Media module unit tests', () => {
  describe('MediaMapper', () => {
    it('maps row to response with clean camelCase keys', () => {
      const res = MediaMapper.toResponse({
        IdMedia: 1,
        IdMediaType: 5,
        IdGame: 10,
        Url: 'https://cdn.test/shot1.jpg',
        MediaTypeName: 'Screenshot',
        NameGame: 'Game',
        Price: 29.99,
      });
      expect(res.idMedia).toBe(1);
      expect((res as any).IdMedia).toBeUndefined();
      expect(res.idMediaType).toBe(5);
      expect((res as any).IdMediaType).toBeUndefined();
      expect(res.idGame).toBe(10);
      expect((res as any).IdGame).toBeUndefined();
      expect(res.url).toBe('https://cdn.test/shot1.jpg');
      expect((res as any).Url).toBeUndefined();
      expect(res.mediaTypeName).toBe('Screenshot');
      expect((res as any).MediaTypeName).toBeUndefined();
      expect(res.nameGame).toBe('Game');
      expect((res as any).NameGame).toBeUndefined();
      expect(res.price).toBe(29.99);
      expect((res as any).Price).toBeUndefined();
    });

    it('handles defaults when fields are missing', () => {
      const res = MediaMapper.toResponse({});
      expect(res.idMedia).toBeNaN();
      expect(res.idMediaType).toBeNaN();
      expect(res.idGame).toBeNaN();
      expect(res.url).toBe('');
      expect(res.mediaTypeName).toBeNull();
      expect(res.nameGame).toBeNull();
      expect(res.price).toBeNull();
    });
  });

  describe('MediaService', () => {
    let mockStore: {
      select: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
      query: jest.Mock;
    };
    let service: MediaService;

    beforeEach(() => {
      mockStore = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        query: jest.fn(),
      };
      service = new MediaService(mockStore as unknown as DataStore);
    });

    it('getScreenshotsByGame queries screenshots by game id', async () => {
      mockStore.query.mockResolvedValue([
        { IdMedia: 1, IdGame: 10, IdMediaType: MEDIA_TYPES.Screenshot, Url: 'shot.jpg' },
      ]);
      const res = await service.getScreenshotsByGame(10);
      expect(res).toHaveLength(1);
      expect(res[0].idMedia).toBe(1);
      expect(mockStore.query).toHaveBeenCalledWith(
        'SELECT m.* FROM [Media] m WHERE m.IdGame = @id AND m.IdMediaType = @type',
        { id: 10, type: MEDIA_TYPES.Screenshot },
      );
    });

    it('getRandomFeatured queries top 6 featured media with game details', async () => {
      mockStore.query.mockResolvedValue([
        { IdMedia: 2, IdGame: 10, IdMediaType: MEDIA_TYPES.Featured, Url: 'feat.jpg', NameGame: 'Game', Price: 10 },
      ]);
      const res = await service.getRandomFeatured();
      expect(res).toHaveLength(1);
      expect(res[0].nameGame).toBe('Game');
    });

    it('getMediaByGame queries non-screenshot media joined with type name', async () => {
      mockStore.query.mockResolvedValue([
        { IdMedia: 3, IdGame: 10, IdMediaType: 3, Url: 'trailer.mp4', MediaTypeName: 'Trailer' },
      ]);
      const res = await service.getMediaByGame(10);
      expect(res).toHaveLength(1);
      expect(res[0].mediaTypeName).toBe('Trailer');
    });

    it('createMedia throws BadRequestException if game does not exist', async () => {
      mockStore.select.mockResolvedValue([]);
      await expect(service.createMedia({ idGame: 99, idMediaType: 1, url: 'u' } as unknown as MediaCreateDto))
        .rejects.toThrow(BadRequestException);
    });

    it('createMedia inserts new screenshot when idMediaType is Screenshot', async () => {
      mockStore.select.mockResolvedValue([{ IdGame: 10 }]);
      mockStore.insert.mockResolvedValue({ IdMedia: 1, IdGame: 10, IdMediaType: MEDIA_TYPES.Screenshot, Url: 'shot.jpg' });

      const res = await service.createMedia({
        idGame: 10,
        idMediaType: MEDIA_TYPES.Screenshot,
        url: 'shot.jpg',
      } as unknown as MediaCreateDto);

      expect(res.idMedia).toBe(1);
      expect(mockStore.insert).toHaveBeenCalledWith('Media', {
        IdGame: 10,
        IdMediaType: MEDIA_TYPES.Screenshot,
        Url: 'shot.jpg',
      });
    });

    it('createMedia updates existing media when non-screenshot already exists', async () => {
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 10 }]) // game exists
        .mockResolvedValueOnce([{ IdMedia: 5, IdGame: 10, IdMediaType: MEDIA_TYPES.Featured }]); // media exists
      mockStore.update
        .mockResolvedValueOnce([{ IdMedia: 5, IdGame: 10, IdMediaType: MEDIA_TYPES.Featured, Url: 'updated.jpg' }]) // update media
        .mockResolvedValueOnce([{ IdGame: 10 }]); // update game thumbnail

      const res = await service.createMedia({
        idGame: 10,
        idMediaType: MEDIA_TYPES.Featured,
        url: 'updated.jpg',
      } as unknown as MediaCreateDto);

      expect(res.idMedia).toBe(5);
      expect(mockStore.update).toHaveBeenCalledWith('Media', { IdMedia: 5 }, { Url: 'updated.jpg' });
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 10 }, { ImgThumbnail: 'updated.jpg' });
    });

    it('createMedia inserts new media when non-screenshot does not exist and updates game thumbnail if Featured', async () => {
      mockStore.select
        .mockResolvedValueOnce([{ IdGame: 10 }]) // game exists
        .mockResolvedValueOnce([]); // no existing media
      mockStore.insert.mockResolvedValue({ IdMedia: 6, IdGame: 10, IdMediaType: MEDIA_TYPES.Featured, Url: 'new_feat.jpg' });
      mockStore.update.mockResolvedValue([{ IdGame: 10 }]);

      const res = await service.createMedia({
        idGame: 10,
        idMediaType: MEDIA_TYPES.Featured,
        url: 'new_feat.jpg',
      } as unknown as MediaCreateDto);

      expect(res.idMedia).toBe(6);
      expect(mockStore.insert).toHaveBeenCalledWith('Media', {
        IdGame: 10,
        IdMediaType: MEDIA_TYPES.Featured,
        Url: 'new_feat.jpg',
      });
      expect(mockStore.update).toHaveBeenCalledWith('Games', { IdGame: 10 }, { ImgThumbnail: 'new_feat.jpg' });
    });
  });

  describe('MediaController', () => {
    let mockService: any;
    let controller: MediaController;

    beforeEach(() => {
      mockService = {
        getScreenshotsByGame: jest.fn().mockResolvedValue([]),
        getRandomFeatured: jest.fn().mockResolvedValue([]),
        getMediaByGame: jest.fn().mockResolvedValue([]),
        createMedia: jest.fn().mockResolvedValue({ idMedia: 1 }),
      };
      controller = new MediaController(mockService);
    });

    it('delegates calls correctly', async () => {
      await controller.getScreenshotsByGame(10);
      expect(mockService.getScreenshotsByGame).toHaveBeenCalledWith(10);

      await controller.getRandomFeatured();
      expect(mockService.getRandomFeatured).toHaveBeenCalled();

      await controller.getMediaByGame(10);
      expect(mockService.getMediaByGame).toHaveBeenCalledWith(10);

      await controller.createMedia({ idGame: 1, idMediaType: 2, url: 'u' } as unknown as MediaCreateDto);
      expect(mockService.createMedia).toHaveBeenCalled();
    });

    it('MediaModule is defined', () => {
      expect(MediaModule).toBeDefined();
      const module = new MediaModule();
      expect(module).toBeInstanceOf(MediaModule);
    });
  });
});
