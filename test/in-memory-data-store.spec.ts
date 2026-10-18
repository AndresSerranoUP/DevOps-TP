import { InMemoryDataStore } from './in-memory-data-store';
import {
  DuplicateKeyError,
  ForeignKeyError,
  UnknownTableOrColumnError,
} from '../src/store/data-store';
import { StoreModule } from '../src/store/store.module';

describe('InMemoryDataStore & Store module unit tests', () => {
  let store: InMemoryDataStore;

  beforeEach(() => {
    store = new InMemoryDataStore();
    store.clear();
  });

  describe('Error classes', () => {
    it('creates error classes with messages and names', () => {
      const orig = new Error('original');
      const dup = new DuplicateKeyError('dup msg', orig);
      expect(dup.name).toBe('DuplicateKeyError');
      expect(dup.message).toBe('dup msg');
      expect(dup.originalError).toBe(orig);

      const fk = new ForeignKeyError('fk msg', orig);
      expect(fk.name).toBe('ForeignKeyError');
      expect(fk.message).toBe('fk msg');

      const unk = new UnknownTableOrColumnError('unk msg', orig);
      expect(unk.name).toBe('UnknownTableOrColumnError');
      expect(unk.message).toBe('unk msg');
    });
  });

  describe('CRUD operations', () => {
    it('inserts with identity, counts, selects, updates, and deletes', async () => {
      // 1. Insert Developer
      const dev = await store.insert<{ IdDeveloper: number; NameDeveloper: string }>('Developers', {
        NameDeveloper: 'Valve',
      });
      expect(dev.IdDeveloper).toBe(1);
      expect(dev.NameDeveloper).toBe('Valve');

      // 2. Count
      expect(await store.count({ table: 'Developers' })).toBe(1);

      // 3. Select with where and projection
      const selected = await store.select({
        table: 'Developers',
        where: { IdDeveloper: 1 },
        columns: ['NameDeveloper'],
      });
      expect(selected).toEqual([{ NameDeveloper: 'Valve' }]);

      // 4. Update
      const updated = await store.update('Developers', { IdDeveloper: 1 }, { NameDeveloper: 'Valve Corporation' });
      expect(updated[0].NameDeveloper).toBe('Valve Corporation');

      // 5. Delete
      const countDeleted = await store.delete('Developers', { IdDeveloper: 1 });
      expect(countDeleted).toBe(1);
      expect(await store.count({ table: 'Developers' })).toBe(0);
    });

    it('throws DuplicateKeyError when violating primary key', async () => {
      await store.insert('Roles', { IdRole: 10, NameRole: 'CustomRole' });
      await expect(store.insert('Roles', { IdRole: 10, NameRole: 'DuplicateRole' }))
        .rejects.toThrow(DuplicateKeyError);
    });

    it('throws ForeignKeyError when referencing non-existent parent row', async () => {
      await expect(store.insert('Games', {
        NameGame: 'Orphan Game',
        Price: 10,
        IdDeveloper: 9999, // does not exist
      })).rejects.toThrow(ForeignKeyError);
    });

    it('supports complex where conditions with operators', async () => {
      await store.insert('Developers', { NameDeveloper: 'Dev A', Disabled: 0 });
      await store.insert('Developers', { NameDeveloper: 'Dev B', Disabled: 1 });
      await store.insert('Developers', { NameDeveloper: 'Studio C', Disabled: 0 });

      // != operator
      const notDisabled = await store.select({
        table: 'Developers',
        where: [{ column: 'Disabled', operator: '!=', value: 1 }],
      });
      expect(notDisabled).toHaveLength(2);

      // LIKE operator
      const likeDev = await store.select({
        table: 'Developers',
        where: [{ column: 'NameDeveloper', operator: 'LIKE', value: '%Dev%' }],
      });
      expect(likeDev).toHaveLength(2);

      // IN operator
      const inList = await store.select({
        table: 'Developers',
        where: [{ column: 'NameDeveloper', operator: 'IN', value: ['Dev A', 'Studio C'] }],
      });
      expect(inList).toHaveLength(2);

      // Ordering and pagination
      const paged = await store.select({
        table: 'Developers',
        orderBy: 'NameDeveloper',
        ascending: false,
        offset: 0,
        limit: 2,
      });
      expect(paged).toHaveLength(2);
      expect(paged[0].NameDeveloper).toBe('Studio C');
    });

    it('transaction runs work callback', async () => {
      const res = await store.transaction(async s => {
        return s.insert('Developers', { NameDeveloper: 'TxDev' });
      });
      expect(res.NameDeveloper).toBe('TxDev');
    });

    it('ping respects health state', async () => {
      expect(await store.ping()).toBe(true);
      store.setHealthy(false);
      expect(await store.ping()).toBe(false);
    });
  });

  describe('query dispatcher coverage for application SQL patterns', () => {
    it('executes all 12 query types', async () => {
      // 1. Health check ping
      const pingRes = await store.query('SELECT 1 AS [ok]');
      expect(pingRes).toEqual([{ ok: 1 }]);

      // Setup data
      const dev = await store.insert<any>('Developers', { NameDeveloper: 'Valve' });
      const user = await store.insert<any>('Users', {
        EmailUser: 'gaben@valvesoftware.com',
        PasswordUser: 'hashed',
        UsernameUser: 'GabeN',
        IsVerified: true,
      });
      await store.insert('DevelopersUsers', { IdUser: user.IdUser, IdDeveloper: dev.IdDeveloper, Rango: 0 });
      const game = await store.insert<any>('Games', {
        NameGame: 'Half-Life',
        Price: 9.99,
        IdDeveloper: dev.IdDeveloper,
        Disabled: 0,
      });
      const genre = await store.insert<any>('Genres', { NameGenre: 'Sci-Fi', Disabled: 0 });
      await store.insert('GamesGenres', { IdGame: game.IdGame, IdGenre: genre.IdGenre });
      await store.insert('UsersGames', { IdUser: user.IdUser, IdGame: game.IdGame, BuyDate: new Date() });
      await store.insert('Media', { IdGame: game.IdGame, IdMediaType: 5, Url: 'shot.jpg' });
      await store.insert('Media', { IdGame: game.IdGame, IdMediaType: 2, Url: 'feat.jpg' });

      // 2. Auth login
      const login = await store.query(
        'SELECT TOP 1 * FROM [Users] WHERE [EmailUser]=@email AND [PasswordUser]=@password',
        { email: 'gaben@valvesoftware.com', password: 'hashed' },
      );
      expect(login).toHaveLength(1);

      // 3. User Developer
      const userDev = await store.query(
        'SELECT TOP 1 d.* FROM [Developers] d JOIN [DevelopersUsers] du ON du.IdDeveloper=d.IdDeveloper WHERE du.IdUser=@id',
        { id: user.IdUser },
      );
      expect(userDev).toHaveLength(1);
      expect(userDev[0].NameDeveloper).toBe('Valve');

      // 4. Developers by name
      const devSearch = await store.query(
        'SELECT * FROM [Developers] WHERE [NameDeveloper] LIKE @name',
        { name: '%Val%' },
      );
      expect(devSearch).toHaveLength(1);

      // 5. Game by genre
      const gameByGenre = await store.query(
        'SELECT g.* FROM [Games] g JOIN [GamesGenres] gg ON gg.IdGame = g.IdGame WHERE gg.IdGenre = @id AND g.Disabled = 0',
        { id: genre.IdGenre },
      );
      expect(gameByGenre).toHaveLength(1);

      // 6. Game by name
      const gameByName = await store.query(
        'SELECT TOP 5 * FROM [Games] WHERE [Disabled] = 0 AND [NameGame] LIKE @name ORDER BY [IdGame] ASC',
        { name: '%Half%' },
      );
      expect(gameByName).toHaveLength(1);

      // 7. GamesGenres join (single id & batch)
      const ggSingle = await store.query(
        'SELECT gg.IdGame, g.IdGenre, g.NameGenre FROM [GamesGenres] gg JOIN [Genres] g ON g.IdGenre = gg.IdGenre WHERE gg.IdGame = @id',
        { id: game.IdGame },
      );
      expect(ggSingle).toHaveLength(1);

      const ggBatch = await store.query(
        'SELECT gg.IdGame, g.IdGenre, g.NameGenre FROM [GamesGenres] gg JOIN [Genres] g ON g.IdGenre = gg.IdGenre WHERE gg.IdGame IN (@gid_0)',
        { gid_0: game.IdGame },
      );
      expect(ggBatch).toHaveLength(1);

      // 8. UsersGames batch
      const ugBatch = await store.query(
        'SELECT IdGame FROM [UsersGames] WHERE IdUser = @userId AND IdGame IN (@gid_0)',
        { userId: user.IdUser, gid_0: game.IdGame },
      );
      expect(ugBatch).toHaveLength(1);

      // 9. User Library
      const lib = await store.query(
        'SELECT ug.BuyDate, g.* FROM [UsersGames] ug JOIN [Games] g ON g.IdGame = ug.IdGame WHERE ug.IdUser = @userId',
        { userId: user.IdUser },
      );
      expect(lib).toHaveLength(1);

      // 10. Screenshots by Game
      const shots = await store.query(
        'SELECT m.* FROM [Media] m WHERE m.IdGame = @id AND m.IdMediaType = @type',
        { id: game.IdGame, type: 5 },
      );
      expect(shots).toHaveLength(1);

      // 11. Random Featured
      const feat = await store.query(
        'SELECT TOP 6 m.*, g.NameGame, g.Price FROM [Media] m JOIN [Games] g ON g.IdGame = m.IdGame WHERE m.IdMediaType = @type AND g.Disabled = 0 ORDER BY NEWID()',
        { type: 2 },
      );
      expect(feat).toHaveLength(1);

      // 12. Media by Game
      const mediaByGame = await store.query(
        'SELECT m.*, mt.MediaTypeName FROM [Media] m JOIN [MediaType] mt ON mt.IdMediaType = m.IdMediaType WHERE m.IdGame = @id AND m.IdMediaType != @screenshotType',
        { id: game.IdGame, screenshotType: 5 },
      );
      expect(mediaByGame).toHaveLength(1);
    });

    it('returns empty array for unmatched raw queries', async () => {
      const res = await store.query('UNKNOWN SQL STATEMENT');
      expect(res).toEqual([]);
    });
  });

  describe('StoreModule', () => {
    it('StoreModule is defined', () => {
      expect(StoreModule).toBeDefined();
      const module = new StoreModule({} as any, {} as any);
      expect(module).toBeInstanceOf(StoreModule);
    });
  });
});
