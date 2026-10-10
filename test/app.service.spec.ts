import { GenresService } from '../src/genres/genres.service';
import { DataStore } from '../src/store/data-store';
import { paginate } from '../src/common/pagination/paginate';
import { UrlBuilder } from '../src/common/pagination/url-builder';
import { DevelopersMapper } from '../src/developers/developers.mapper';
import { GamesMapper } from '../src/games/games.mapper';
import { RolesMapper } from '../src/roles/roles.mapper';
import { SocialLinksMapper } from '../src/social-links/social-links.mapper';
import { MediaMapper } from '../src/media/media.mapper';
import { DeveloperUsersMapper } from '../src/developer-users/developer-users.mapper';

describe('Domain services, mappers and pagination', () => {
  it('GenresService delegates reads to DataStore and maps responses', async () => {
    const dataStore = {
      select: jest.fn().mockResolvedValue([{ IdGenre: 1, NameGenre: 'Action', Disabled: 0 }]),
    } as unknown as DataStore;
    const service = new GenresService(dataStore);
    const result = await service.getAll();
    expect(result).toEqual([
      expect.objectContaining({ idGenre: 1, nameGenre: 'Action' }),
    ]);
  });

  it('paginate returns correct metadata with actual pageSize', async () => {
    const countFn = jest.fn().mockResolvedValue(15);
    const itemsFn = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await paginate(countFn, itemsFn, { page: 1, pageSize: 10 });
    expect(result.pageNumber).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.totalNumberOfRecords).toBe(15);
    expect(result.totalNumberOfPages).toBe(2);
  });

  it('UrlBuilder preserves absolute URLs with protocol and host', () => {
    const abs = UrlBuilder.buildPageUrl('https://api.example.com/api/Game/GetAll', 2, 10);
    expect(abs).toBe('https://api.example.com/api/Game/GetAll?page=2&pageSize=10');

    const rel = UrlBuilder.buildPageUrl('/api/Game/GetAll', 2, 10);
    expect(rel).toBe('/api/Game/GetAll?page=2&pageSize=10');
  });

  it('DevelopersMapper maps PascalCase to clean camelCase', () => {
    const mapped = DevelopersMapper.toResponse({
      IdDeveloper: 5,
      NameDeveloper: 'DevStudios',
      LogoDeveloper: 'logo.png',
      LongDescription: 'Long desc',
      ShortDescription: 'Short desc',
      Disabled: 0,
    });
    expect(mapped.idDeveloper).toBe(5);
    expect(mapped.nameDeveloper).toBe('DevStudios');
    expect(mapped.logoDeveloper).toBe('logo.png');
    expect(mapped.longDescription).toBe('Long desc');
    expect(mapped.shortDescription).toBe('Short desc');
    expect((mapped as any).IdDeveloper).toBeUndefined();
  });

  it('GamesMapper maps game properties including ratings, ownership and genres', () => {
    const mapped = GamesMapper.toResponse({
      IdGame: 10,
      NameGame: 'Great Game',
      ReleaseDate: '2026-01-01',
      IdDeveloper: 5,
      Price: 29.99,
      Size: 50.5,
      isOwned: true,
      likes: 10,
      dislikes: 1,
      genero: 'Action, RPG',
    });
    expect(mapped.idGame).toBe(10);
    expect(mapped.nameGame).toBe('Great Game');
    expect(mapped.price).toBe(29.99);
    expect(mapped.size).toBe(50.5);
    expect(mapped.isOwned).toBe(true);
    expect(mapped.likes).toBe(10);
    expect(mapped.dislikes).toBe(1);
    expect(mapped.genero).toBe('Action, RPG');
  });

  it('RolesMapper maps role properties', () => {
    const mapped = RolesMapper.toResponse({ IdRole: 2, NameRole: 'Admin' });
    expect(mapped.idRole).toBe(2);
    expect(mapped.roleName).toBe('Admin');
    expect((mapped as any).IdRole).toBeUndefined();
    expect((mapped as any).NameRole).toBeUndefined();
  });

  it('SocialLinksMapper maps webUrl and webName properties', () => {
    const mapped = SocialLinksMapper.toResponse({
      IdSocialLink: 1,
      NameSocialLink: 'Twitter',
      UrlSocialLink: 'https://twitter.com/dev',
    });
    expect(mapped.idSocialLink).toBe(1);
    expect(mapped.webName).toBe('Twitter');
    expect(mapped.webUrl).toBe('https://twitter.com/dev');
  });

  it('MediaMapper maps media properties', () => {
    const mapped = MediaMapper.toResponse({
      IdMedia: 3,
      IdMediaType: 1,
      IdGame: 10,
      Url: 'http://img.jpg',
      MediaTypeName: 'Screenshot',
    });
    expect(mapped.idMedia).toBe(3);
    expect(mapped.idMediaType).toBe(1);
    expect(mapped.idGame).toBe(10);
    expect(mapped.url).toBe('http://img.jpg');
    expect(mapped.mediaTypeName).toBe('Screenshot');
  });

  it('DeveloperUsersMapper maps developer user properties', () => {
    const mapped = DeveloperUsersMapper.toResponse({
      IdUser: 12,
      IdDeveloper: 5,
      Rango: 2,
    });
    expect(mapped.idUser).toBe(12);
    expect(mapped.idDeveloper).toBe(5);
    expect(mapped.rango).toBe(2);
  });
});
