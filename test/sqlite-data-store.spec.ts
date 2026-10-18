import { SqliteDataStore } from '../src/store/sqlite-data-store';
import {
  DuplicateKeyError,
  ForeignKeyError,
  UnknownTableOrColumnError,
} from '../src/store/data-store';
import { AppConfig } from '../src/config/app-config';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';

describe('SqliteDataStore', () => {
  let store: SqliteDataStore;
  let memDb: Database.Database;

  const createSchema = (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS [Roles] (
        [IdRole] INTEGER PRIMARY KEY AUTOINCREMENT,
        [NameRole] TEXT NOT NULL,
        [Disabled] INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS [Developers] (
        [IdDeveloper] INTEGER PRIMARY KEY AUTOINCREMENT,
        [NameDeveloper] TEXT NOT NULL,
        [LogoDeveloper] TEXT,
        [LongDescription] TEXT,
        [ShortDescription] TEXT,
        [Disabled] INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS [Users] (
        [IdUser] INTEGER PRIMARY KEY AUTOINCREMENT,
        [EmailUser] TEXT NOT NULL,
        [PasswordUser] TEXT NOT NULL,
        [UsernameUser] TEXT NOT NULL,
        [ImgAvatar] TEXT,
        [HashUser] TEXT,
        [IsVerified] INTEGER DEFAULT 0,
        [IdRole] INTEGER,
        [Disabled] INTEGER DEFAULT 0,
        FOREIGN KEY ([IdRole]) REFERENCES [Roles]([IdRole])
      );

      CREATE TABLE IF NOT EXISTS [Games] (
        [IdGame] INTEGER PRIMARY KEY AUTOINCREMENT,
        [NameGame] TEXT NOT NULL,
        [ReleaseDate] TEXT,
        [IdDeveloper] INTEGER NOT NULL,
        [ImgThumbnail] TEXT,
        [ImgLogo] TEXT,
        [ImgBackground] TEXT,
        [Size] NUMERIC,
        [Price] NUMERIC NOT NULL,
        [LongDescription] TEXT,
        [ShortDescription] TEXT,
        [MinRam] TEXT,
        [MinGpu] TEXT,
        [MinCpu] TEXT,
        [MinOs] TEXT,
        [IdSteam] INTEGER,
        [Disabled] INTEGER DEFAULT 0,
        FOREIGN KEY ([IdDeveloper]) REFERENCES [Developers]([IdDeveloper])
      );

      CREATE TABLE IF NOT EXISTS [Genres] (
        [IdGenre] INTEGER PRIMARY KEY AUTOINCREMENT,
        [NameGenre] TEXT NOT NULL,
        [Disabled] INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS [GamesGenres] (
        [IdGame] INTEGER NOT NULL,
        [IdGenre] INTEGER NOT NULL,
        PRIMARY KEY ([IdGame], [IdGenre]),
        FOREIGN KEY ([IdGame]) REFERENCES [Games]([IdGame]),
        FOREIGN KEY ([IdGenre]) REFERENCES [Genres]([IdGenre])
      );

      CREATE TABLE IF NOT EXISTS [UsersGames] (
        [IdUser] INTEGER NOT NULL,
        [IdGame] INTEGER NOT NULL,
        [BuyDate] TEXT,
        PRIMARY KEY ([IdUser], [IdGame]),
        FOREIGN KEY ([IdUser]) REFERENCES [Users]([IdUser]),
        FOREIGN KEY ([IdGame]) REFERENCES [Games]([IdGame])
      );

      CREATE TABLE IF NOT EXISTS [MediaType] (
        [IdMediaType] INTEGER PRIMARY KEY AUTOINCREMENT,
        [MediaTypeName] TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS [Media] (
        [IdMedia] INTEGER PRIMARY KEY AUTOINCREMENT,
        [IdGame] INTEGER NOT NULL,
        [IdMediaType] INTEGER NOT NULL,
        [Url] TEXT NOT NULL,
        FOREIGN KEY ([IdGame]) REFERENCES [Games]([IdGame]),
        FOREIGN KEY ([IdMediaType]) REFERENCES [MediaType]([IdMediaType])
      );
    `);
  };

  beforeEach(() => {
    memDb = new Database(':memory:');
    createSchema(memDb);
    store = new SqliteDataStore();
    store.setDatabase(memDb);
  });

  afterEach(() => {
    store.onModuleDestroy();
  });

  describe('Lifecycle and connection', () => {
    it('initializes lazily with custom in-memory database and pings successfully', async () => {
      expect(await store.ping()).toBe(true);
    });

    it('initializes using AppConfig and resolves db path', async () => {
      const config = new ConfigService({
        SQLITE_DB_PATH: ':memory:',
      });
      const appConfig = new AppConfig(config);
      const appStore = new SqliteDataStore(appConfig);
      expect(await appStore.ping()).toBe(true);
      appStore.onModuleDestroy();
    });

    it('handles ping failure gracefully', async () => {
      const closedDb = new Database(':memory:');
      const closedStore = new SqliteDataStore();
      closedStore.setDatabase(closedDb);
      closedDb.close();
      expect(await closedStore.ping()).toBe(false);
    });
  });

  describe('CRUD Operations', () => {
    it('inserts a row with identity auto-generation and returns the created row', async () => {
      const dev = await store.insert<{ IdDeveloper: number; NameDeveloper: string }>('Developers', {
        NameDeveloper: 'Nintendo',
      });
      expect(dev.IdDeveloper).toBe(1);
      expect(dev.NameDeveloper).toBe('Nintendo');
    });

    it('inserts a row with an explicit primary key', async () => {
      const role = await store.insert<{ IdRole: number; NameRole: string }>('Roles', {
        IdRole: 99,
        NameRole: 'SuperAdmin',
      });
      expect(role.IdRole).toBe(99);
      expect(role.NameRole).toBe('SuperAdmin');
    });

    it('throws DuplicateKeyError on primary key violation', async () => {
      await store.insert('Roles', { IdRole: 1, NameRole: 'Admin' });
      await expect(store.insert('Roles', { IdRole: 1, NameRole: 'DuplicateAdmin' })).rejects.toThrow(
        DuplicateKeyError,
      );
    });

    it('throws ForeignKeyError when referencing non-existent foreign record', async () => {
      await expect(
        store.insert('Games', {
          NameGame: 'Orphan',
          Price: 59.99,
          IdDeveloper: 9999,
        }),
      ).rejects.toThrow(ForeignKeyError);
    });

    it('throws error when inserting with empty values', async () => {
      await expect(store.insert('Developers', {})).rejects.toThrow(
        'At least one value is required for insert',
      );
    });

    it('throws UnknownTableOrColumnError for invalid table', async () => {
      await expect(store.insert('NonExistentTable', { Foo: 'Bar' })).rejects.toThrow(
        UnknownTableOrColumnError,
      );
    });

    it('counts rows with object and overloaded string signatures', async () => {
      await store.insert('Developers', { NameDeveloper: 'Dev 1' });
      await store.insert('Developers', { NameDeveloper: 'Dev 2' });

      expect(await store.count({ table: 'Developers' })).toBe(2);
      expect(await store.count('Developers')).toBe(2);
      expect(await store.count('Developers', { NameDeveloper: 'Dev 1' })).toBe(1);
    });

    it('selects rows with columns projection, ordering, and where conditions', async () => {
      await store.insert('Developers', { NameDeveloper: 'Valve', Disabled: 0 });
      await store.insert('Developers', { NameDeveloper: 'Ubisoft', Disabled: 1 });
      await store.insert('Developers', { NameDeveloper: 'Blizzard', Disabled: 0 });

      // Projection and equality where
      const results = await store.select<{ NameDeveloper: string }>({
        table: 'Developers',
        columns: ['NameDeveloper'],
        where: { Disabled: 0 },
        orderBy: 'NameDeveloper',
        ascending: true,
      });
      expect(results).toEqual([{ NameDeveloper: 'Blizzard' }, { NameDeveloper: 'Valve' }]);

      // Fallback on invalid orderBy column prevents SQL injection
      const fallback = await store.select<{ NameDeveloper: string }>({
        table: 'Developers',
        orderBy: '1; DROP TABLE Developers; --',
      });
      expect(fallback.length).toBe(3);
    });

    it('supports complex where operators (LIKE, IN, !=, <, <=, >, >=, IS NULL, IS NOT NULL)', async () => {
      await store.insert('Developers', { NameDeveloper: 'Valve', ShortDescription: null, Disabled: 0 });
      await store.insert('Developers', { NameDeveloper: 'Square Enix', ShortDescription: 'RPG Studio', Disabled: 1 });
      await store.insert('Developers', { NameDeveloper: 'Sony', ShortDescription: 'Playstation', Disabled: 0 });

      // LIKE operator
      const likeRes = await store.select({
        table: 'Developers',
        where: [{ column: 'NameDeveloper', operator: 'LIKE', value: '%va%' }],
      });
      expect(likeRes.length).toBe(1);

      // IN operator
      const inRes = await store.select({
        table: 'Developers',
        where: [{ column: 'NameDeveloper', operator: 'IN', value: ['Valve', 'Sony'] }],
      });
      expect(inRes.length).toBe(2);

      // Empty IN operator matches nothing
      const emptyInRes = await store.select({
        table: 'Developers',
        where: [{ column: 'NameDeveloper', operator: 'IN', value: [] }],
      });
      expect(emptyInRes.length).toBe(0);

      // IS NULL operator
      const nullRes = await store.select({
        table: 'Developers',
        where: [{ column: 'ShortDescription', operator: '=', value: null }],
      });
      expect(nullRes.length).toBe(1);

      // IS NOT NULL operator
      const notNullRes = await store.select({
        table: 'Developers',
        where: [{ column: 'ShortDescription', operator: '!=', value: null }],
      });
      expect(notNullRes.length).toBe(2);

      // Relational operators
      const relRes = await store.select({
        table: 'Developers',
        where: [{ column: 'Disabled', operator: '>', value: 0 }],
      });
      expect(relRes.length).toBe(1);
    });

    it('supports pagination with offset and limit', async () => {
      for (let i = 1; i <= 5; i++) {
        await store.insert('Developers', { NameDeveloper: `Dev ${i}` });
      }

      // Limit only
      const limitOnly = await store.select({
        table: 'Developers',
        limit: 2,
        orderBy: 'IdDeveloper',
        ascending: true,
      });
      expect(limitOnly.length).toBe(2);

      // Offset and Limit
      const paged = await store.select({
        table: 'Developers',
        offset: 2,
        limit: 2,
        orderBy: 'IdDeveloper',
        ascending: true,
      });
      expect(paged.length).toBe(2);
      expect((paged[0] as any).NameDeveloper).toBe('Dev 3');

      // Offset only
      const offsetOnly = await store.select({
        table: 'Developers',
        offset: 3,
        orderBy: 'IdDeveloper',
        ascending: true,
      });
      expect(offsetOnly.length).toBe(2);
    });

    it('supports joins in select and count', async () => {
      const dev = await store.insert<{ IdDeveloper: number }>('Developers', { NameDeveloper: 'FromSoftware' });
      const game = await store.insert<{ IdGame: number }>('Games', {
        NameGame: 'Elden Ring',
        Price: 59.99,
        IdDeveloper: dev.IdDeveloper,
      });
      const genre = await store.insert<{ IdGenre: number }>('Genres', { NameGenre: 'Action RPG' });
      await store.insert('GamesGenres', { IdGame: game.IdGame, IdGenre: genre.IdGenre });

      const joined = await store.select({
        table: 'Games',
        columns: ['NameGame'],
        joins: [
          { type: 'INNER', table: 'GamesGenres', on: '[GamesGenres].[IdGame] = [Games].[IdGame]' },
          { type: 'INNER', table: 'Genres', on: '[Genres].[IdGenre] = [GamesGenres].[IdGenre]' },
        ],
        where: [{ column: '[Genres].[IdGenre]', operator: '=', value: genre.IdGenre }],
      });
      expect(joined).toEqual([{ NameGame: 'Elden Ring' }]);

      const countJoined = await store.count({
        table: 'Games',
        joins: [
          { type: 'INNER', table: 'GamesGenres', on: '[GamesGenres].[IdGame] = [Games].[IdGame]' },
        ],
      });
      expect(countJoined).toBe(1);
    });

    it('updates matching rows and returns updated rows with RETURNING *', async () => {
      const dev = await store.insert<{ IdDeveloper: number }>('Developers', { NameDeveloper: 'Old Name' });
      const updated = await store.update<{ IdDeveloper: number; NameDeveloper: string }>(
        'Developers',
        { IdDeveloper: dev.IdDeveloper },
        { NameDeveloper: 'New Name' },
      );
      expect(updated).toHaveLength(1);
      expect(updated[0].NameDeveloper).toBe('New Name');

      // Empty update values selects without modifications
      const unchanged = await store.update(
        'Developers',
        { IdDeveloper: dev.IdDeveloper },
        {},
      );
      expect(unchanged).toHaveLength(1);
    });

    it('deletes matching rows and returns the number of deleted records', async () => {
      const dev = await store.insert<{ IdDeveloper: number }>('Developers', { NameDeveloper: 'ToDelete' });
      const deleted = await store.delete('Developers', { IdDeveloper: dev.IdDeveloper });
      expect(deleted).toBe(1);
      expect(await store.count('Developers')).toBe(0);
    });
  });

  describe('Transactions', () => {
    it('commits transaction changes on successful completion', async () => {
      await store.transaction(async tx => {
        await tx.insert('Developers', { NameDeveloper: 'TxDev1' });
        await tx.insert('Developers', { NameDeveloper: 'TxDev2' });
      });
      expect(await store.count('Developers')).toBe(2);
    });

    it('rolls back transaction changes when error is thrown', async () => {
      await expect(
        store.transaction(async tx => {
          await tx.insert('Developers', { NameDeveloper: 'WillRollback' });
          throw new Error('Transaction failure');
        }),
      ).rejects.toThrow('Transaction failure');

      expect(await store.count('Developers')).toBe(0);
    });

    it('supports nested transactions using savepoints', async () => {
      await store.transaction(async tx => {
        await tx.insert('Developers', { NameDeveloper: 'OuterDev' });

        await expect(
          tx.transaction(async nestedTx => {
            await nestedTx.insert('Developers', { NameDeveloper: 'InnerDev' });
            throw new Error('Nested failure');
          }),
        ).rejects.toThrow('Nested failure');
      });

      const devs = await store.select<{ NameDeveloper: string }>({ table: 'Developers' });
      expect(devs).toHaveLength(1);
      expect(devs[0].NameDeveloper).toBe('OuterDev');
    });
  });

  describe('Raw queries & T-SQL translation', () => {
    it('converts SELECT TOP 1 syntax to LIMIT 1', async () => {
      await store.insert('Developers', { NameDeveloper: 'DevA' });
      await store.insert('Developers', { NameDeveloper: 'DevB' });

      const rows = await store.query<{ NameDeveloper: string }>(
        'SELECT TOP 1 * FROM [Developers] ORDER BY [IdDeveloper] ASC',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].NameDeveloper).toBe('DevA');
    });

    it('converts NEWID() to RANDOM() for ordering', async () => {
      await store.insert('Developers', { NameDeveloper: 'Dev1' });
      const rows = await store.query(
        'SELECT TOP 1 * FROM [Developers] ORDER BY NEWID()',
      );
      expect(rows).toHaveLength(1);
    });

    it('handles named parameters with and without @ prefix', async () => {
      await store.insert('Developers', { NameDeveloper: 'Valve' });

      const withAt = await store.query(
        'SELECT * FROM [Developers] WHERE [NameDeveloper] = @name',
        { '@name': 'Valve' },
      );
      expect(withAt).toHaveLength(1);

      const withoutAt = await store.query(
        'SELECT * FROM [Developers] WHERE [NameDeveloper] = @name',
        { name: 'Valve' },
      );
      expect(withoutAt).toHaveLength(1);

      const wrappedObject = await store.query(
        'SELECT * FROM [Developers] WHERE [NameDeveloper] = @name',
        { name: { type: 'NVarChar', value: 'Valve' } },
      );
      expect(wrappedObject).toHaveLength(1);
    });

    it('executes non-reader raw queries and returns changes', async () => {
      const res = await store.query(
        'INSERT INTO [Developers] ([NameDeveloper]) VALUES (@name)',
        { name: 'RawDev' },
      );
      expect(res).toHaveLength(1);
      expect((res[0] as any).changes).toBe(1);
      expect(await store.count('Developers')).toBe(1);
    });
  });

  describe('Integration with real data/database.sqlite3', () => {
    it('opens project SQLite database and queries existing data', async () => {
      const realStore = new SqliteDataStore();
      realStore.setDatabase('data/database.sqlite3');
      expect(await realStore.ping()).toBe(true);

      const devs = await realStore.select<{ NameDeveloper: string }>({
        table: 'Developers',
        limit: 3,
        orderBy: 'IdDeveloper',
        ascending: true,
      });
      expect(devs.length).toBeGreaterThanOrEqual(1);
      expect(devs[0].NameDeveloper).toBeDefined();

      realStore.onModuleDestroy();
    });
  });
});
