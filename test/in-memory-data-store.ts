import {
  DataStore,
  DuplicateKeyError,
  ForeignKeyError,
  Row,
  SelectQuery,
  Where,
} from '../src/store/data-store';
import { SCHEMA } from '../src/store/schema';

export class InMemoryDataStore extends DataStore {
  private tables: Map<string, Row[]> = new Map();
  private autoIncrements: Map<string, number> = new Map();
  private healthy = true;

  constructor() {
    super();
    this.initTables();
    this.seedDefaultData();
  }

  private initTables(): void {
    for (const tableName of Object.keys(SCHEMA)) {
      this.tables.set(tableName.toLowerCase(), []);
      this.autoIncrements.set(tableName.toLowerCase(), 1);
    }
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  clear(): void {
    this.tables.clear();
    this.autoIncrements.clear();
    this.initTables();
    this.seedDefaultData();
  }

  seedDefaultData(): void {
    const rolesTable = this.getTableRows('Roles');
    if (rolesTable.length === 0) {
      rolesTable.push(
        { IdRole: 1, NameRole: 'User', Disabled: 0 },
        { IdRole: 4, NameRole: 'Administrator', Disabled: 0 },
      );
      this.autoIncrements.set('roles', 5);
    }

    const genresTable = this.getTableRows('Genres');
    if (genresTable.length === 0) {
      genresTable.push(
        { IdGenre: 1, NameGenre: 'Action', Disabled: 0 },
        { IdGenre: 2, NameGenre: 'RPG', Disabled: 0 },
        { IdGenre: 3, NameGenre: 'Adventure', Disabled: 0 },
      );
      this.autoIncrements.set('genres', 4);
    }

    const mediaTypesTable = this.getTableRows('MediaType');
    if (mediaTypesTable.length === 0) {
      mediaTypesTable.push(
        { IdMediaType: 1, MediaTypeName: 'Trailer' },
        { IdMediaType: 2, MediaTypeName: 'Featured' },
        { IdMediaType: 5, MediaTypeName: 'Screenshot' },
      );
      this.autoIncrements.set('mediatype', 6);
    }
  }

  private getTableRows(table: string): Row[] {
    const lower = table.toLowerCase();
    if (!this.tables.has(lower)) {
      this.tables.set(lower, []);
      this.autoIncrements.set(lower, 1);
    }
    return this.tables.get(lower)!;
  }

  private matchesCondition(row: Row, col: string, op: string, expected: unknown): boolean {
    const actual = this.getFieldValue(row, col);

    switch (op) {
      case '=':
        return actual == expected;
      case '!=':
        return actual != expected;
      case '<':
        return (actual as any) < (expected as any);
      case '<=':
        return (actual as any) <= (expected as any);
      case '>':
        return (actual as any) > (expected as any);
      case '>=':
        return (actual as any) >= (expected as any);
      case 'LIKE': {
        const pattern = String(expected).replace(/%/g, '').toLowerCase();
        return String(actual ?? '').toLowerCase().includes(pattern);
      }
      case 'IN':
        return Array.isArray(expected) ? expected.some(e => e == actual) : actual == expected;
      default:
        return actual == expected;
    }
  }

  private getFieldValue(row: Row, field: string): unknown {
    if (row[field] !== undefined) return row[field];
    const lower = field.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
    return undefined;
  }

  private matchesWhere(row: Row, where?: Where): boolean {
    if (!where) return true;

    if (Array.isArray(where)) {
      for (const cond of where) {
        if (!this.matchesCondition(row, cond.column, cond.operator ?? '=', cond.value)) {
          return false;
        }
      }
      return true;
    }

    for (const [col, val] of Object.entries(where)) {
      if (!this.matchesCondition(row, col, '=', val)) {
        return false;
      }
    }
    return true;
  }

  async select<T = Row>(query: SelectQuery): Promise<T[]> {
    const rows = this.getTableRows(query.table);
    let matched = rows.filter(r => this.matchesWhere(r, query.where));

    if (query.orderBy) {
      const orderCol = query.orderBy;
      const asc = query.ascending !== false;
      matched.sort((a, b) => {
        const valA = this.getFieldValue(a, orderCol);
        const valB = this.getFieldValue(b, orderCol);
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return asc ? -1 : 1;
        if (valB === undefined || valB === null) return asc ? 1 : -1;
        if (valA < valB) return asc ? -1 : 1;
        return asc ? 1 : -1;
      });
    }

    if (query.offset !== undefined || query.limit !== undefined) {
      const start = query.offset ?? 0;
      const end = query.limit !== undefined ? start + query.limit : undefined;
      matched = matched.slice(start, end);
    }

    return matched.map(r => {
      if (!query.columns || query.columns.length === 0) {
        return { ...r } as T;
      }
      const projection: Row = {};
      for (const col of query.columns) {
        projection[col] = this.getFieldValue(r, col);
      }
      return projection as T;
    });
  }

  async count(query: Pick<SelectQuery, 'table' | 'where' | 'joins'>): Promise<number> {
    const rows = this.getTableRows(query.table);
    return rows.filter(r => this.matchesWhere(r, query.where)).length;
  }

  async insert<T = Row>(table: string, values: Record<string, unknown>): Promise<T> {
    const tableDef = SCHEMA[table];
    const rows = this.getTableRows(table);
    const lowerTable = table.toLowerCase();

    const newRow: Row = { ...values };

    if (tableDef?.identity) {
      const idCol = tableDef.identity;
      if (newRow[idCol] === undefined || newRow[idCol] === null) {
        const nextId = this.autoIncrements.get(lowerTable) ?? 1;
        newRow[idCol] = nextId;
        this.autoIncrements.set(lowerTable, nextId + 1);
      }
    }

    // Check duplicate primary keys
    if (tableDef?.pk?.length) {
      const isDuplicate = rows.some(r =>
        tableDef.pk.every(pkCol => this.getFieldValue(r, pkCol) == this.getFieldValue(newRow, pkCol)),
      );
      if (isDuplicate) {
        throw new DuplicateKeyError(`Duplicate primary key for table ${table}`);
      }
    }

    // Check foreign keys
    if (tableDef?.fks) {
      for (const [fkCol, fkDef] of Object.entries(tableDef.fks)) {
        const val = this.getFieldValue(newRow, fkCol);
        if (val !== undefined && val !== null) {
          const targetRows = this.getTableRows(fkDef.table);
          const found = targetRows.some(tr => this.getFieldValue(tr, fkDef.column) == val);
          if (!found) {
            throw new ForeignKeyError(`Foreign key violation on ${table}.${fkCol} -> ${fkDef.table}.${fkDef.column}`);
          }
        }
      }
    }

    rows.push(newRow);
    return { ...newRow } as T;
  }

  async update<T = Row>(table: string, where: Where, values: Record<string, unknown>): Promise<T[]> {
    const rows = this.getTableRows(table);
    const updated: Row[] = [];

    for (const r of rows) {
      if (this.matchesWhere(r, where)) {
        Object.assign(r, values);
        updated.push({ ...r });
      }
    }

    return updated as T[];
  }

  async delete(table: string, where: Where): Promise<number> {
    const rows = this.getTableRows(table);
    const remaining: Row[] = [];
    let count = 0;

    for (const r of rows) {
      if (this.matchesWhere(r, where)) {
        count++;
      } else {
        remaining.push(r);
      }
    }

    this.tables.set(table.toLowerCase(), remaining);
    return count;
  }

  async transaction<T>(work: (store: DataStore) => Promise<T>): Promise<T> {
    return work(this);
  }

  async ping(): Promise<boolean> {
    return this.healthy;
  }

  async query<T = Row>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 1. Health check: SELECT 1 AS [ok]
    if (/SELECT\s+1\s+AS\s+\[ok\]/i.test(cleanSql)) {
      return [{ ok: 1 }] as unknown as T[];
    }

    // 2. Auth login: SELECT TOP 1 * FROM [Users] WHERE [EmailUser]=@email AND [PasswordUser]=@password
    if (/FROM\s+\[Users\]/i.test(cleanSql) && /EmailUser/i.test(cleanSql) && /PasswordUser/i.test(cleanSql)) {
      const users = this.getTableRows('Users');
      const found = users.find(u =>
        u.EmailUser === params.email && u.PasswordUser === params.password,
      );
      return (found ? [{ ...found }] : []) as unknown as T[];
    }

    // 3. User Developer: SELECT TOP 1 d.* FROM [Developers] d JOIN [DevelopersUsers] du ON du.IdDeveloper=d.IdDeveloper WHERE du.IdUser=@id
    if (/FROM\s+\[Developers\]/i.test(cleanSql) && /JOIN\s+\[DevelopersUsers\]/i.test(cleanSql)) {
      const devUsers = this.getTableRows('DevelopersUsers');
      const du = devUsers.find(d => Number(d.IdUser) === Number(params.id));
      if (!du) return [];
      const devs = this.getTableRows('Developers');
      const dev = devs.find(d => Number(d.IdDeveloper) === Number(du.IdDeveloper));
      return (dev ? [{ ...dev }] : []) as unknown as T[];
    }

    // 4. Developers by name: SELECT * FROM [Developers] WHERE [NameDeveloper] LIKE @name
    if (/FROM\s+\[Developers\]/i.test(cleanSql) && /NameDeveloper/i.test(cleanSql) && /LIKE/i.test(cleanSql)) {
      const name = String(params.name ?? '').replace(/%/g, '').toLowerCase();
      const devs = this.getTableRows('Developers');
      const matched = devs.filter(d => String(d.NameDeveloper ?? '').toLowerCase().includes(name));
      return matched.map(d => ({ ...d })) as unknown as T[];
    }

    // 5. Game by genre: SELECT g.* FROM [Games] g JOIN [GamesGenres] gg ON gg.IdGame = g.IdGame WHERE gg.IdGenre = @id AND g.Disabled = 0
    if (/FROM\s+\[Games\]\s+g\s+JOIN\s+\[GamesGenres\]\s+gg/i.test(cleanSql) && /gg\.IdGenre\s*=\s*@id/i.test(cleanSql)) {
      const gameGenres = this.getTableRows('GamesGenres').filter(gg => Number(gg.IdGenre) === Number(params.id));
      const gameIds = new Set(gameGenres.map(gg => Number(gg.IdGame)));
      const games = this.getTableRows('Games').filter(g => gameIds.has(Number(g.IdGame)) && Number(g.Disabled ?? 0) === 0);
      return games.map(g => ({ ...g })) as unknown as T[];
    }

    // 6. Game by name: SELECT TOP 5 * FROM [Games] WHERE [Disabled] = 0 AND [NameGame] LIKE @name ORDER BY [IdGame] ASC
    if (/FROM\s+\[Games\]/i.test(cleanSql) && /NameGame/i.test(cleanSql) && /LIKE/i.test(cleanSql)) {
      const name = String(params.name ?? '').replace(/%/g, '').toLowerCase();
      const games = this.getTableRows('Games').filter(g =>
        Number(g.Disabled ?? 0) === 0 && String(g.NameGame ?? '').toLowerCase().includes(name),
      );
      games.sort((a, b) => Number(a.IdGame) - Number(b.IdGame));
      return games.slice(0, 5).map(g => ({ ...g })) as unknown as T[];
    }

    // 7. GamesGenres batch / single: SELECT ... FROM [GamesGenres] gg JOIN [Genres] g ON g.IdGenre = gg.IdGenre WHERE ...
    if (/FROM\s+\[GamesGenres\]\s+gg\s+JOIN\s+\[Genres\]\s+g/i.test(cleanSql)) {
      const allGG = this.getTableRows('GamesGenres');
      const allGenres = this.getTableRows('Genres');
      const genreMap = new Map(allGenres.map(g => [Number(g.IdGenre), g]));

      let filterGameIds: number[] = [];
      if (params.id !== undefined) {
        filterGameIds = [Number(params.id)];
      } else {
        filterGameIds = Object.entries(params)
          .filter(([k]) => k.startsWith('gid_'))
          .map(([, v]) => Number(v));
      }

      const results: Row[] = [];
      for (const gg of allGG) {
        if (filterGameIds.length === 0 || filterGameIds.includes(Number(gg.IdGame))) {
          const g = genreMap.get(Number(gg.IdGenre));
          if (g) {
            results.push({
              IdGame: gg.IdGame,
              IdGenre: g.IdGenre,
              NameGenre: g.NameGenre,
            });
          }
        }
      }
      return results as unknown as T[];
    }

    // 8. UsersGames batch: SELECT IdGame FROM [UsersGames] WHERE IdUser = @userId AND IdGame IN (...)
    if (/FROM\s+\[UsersGames\]/i.test(cleanSql) && /IdUser\s*=\s*@userId/i.test(cleanSql) && /IdGame\s+IN/i.test(cleanSql)) {
      const ugRows = this.getTableRows('UsersGames').filter(ug => Number(ug.IdUser) === Number(params.userId));
      const gameIds = Object.entries(params)
        .filter(([k]) => k.startsWith('gid_'))
        .map(([, v]) => Number(v));
      const matched = ugRows.filter(ug => gameIds.includes(Number(ug.IdGame)));
      return matched.map(ug => ({ IdGame: ug.IdGame })) as unknown as T[];
    }

    // 9. User Library: SELECT ug.BuyDate, g.* FROM [UsersGames] ug JOIN [Games] g ON g.IdGame = ug.IdGame WHERE ug.IdUser = @userId
    if (/FROM\s+\[UsersGames\]\s+ug\s+JOIN\s+\[Games\]\s+g/i.test(cleanSql) && /ug\.IdUser\s*=\s*@userId/i.test(cleanSql)) {
      const userGames = this.getTableRows('UsersGames').filter(ug => Number(ug.IdUser) === Number(params.userId));
      const games = this.getTableRows('Games');
      const gameMap = new Map(games.map(g => [Number(g.IdGame), g]));

      const results: Row[] = [];
      for (const ug of userGames) {
        const g = gameMap.get(Number(ug.IdGame));
        if (g) {
          results.push({
            BuyDate: ug.BuyDate,
            ...g,
          });
        }
      }
      return results as unknown as T[];
    }

    // 10. Screenshots by Game: SELECT m.* FROM [Media] m WHERE m.IdGame = @id AND m.IdMediaType = @type
    if (/FROM\s+\[Media\]\s+m/i.test(cleanSql) && /m\.IdGame\s*=\s*@id/i.test(cleanSql) && /m\.IdMediaType\s*=\s*@type/i.test(cleanSql)) {
      const media = this.getTableRows('Media').filter(m =>
        Number(m.IdGame) === Number(params.id) && Number(m.IdMediaType) === Number(params.type),
      );
      return media.map(m => ({ ...m })) as unknown as T[];
    }

    // 11. Random Featured: SELECT TOP 6 m.*, g.NameGame, g.Price FROM [Media] m JOIN [Games] g ON g.IdGame = m.IdGame WHERE m.IdMediaType = @type AND g.Disabled = 0 ORDER BY NEWID()
    if (/FROM\s+\[Media\]\s+m\s+JOIN\s+\[Games\]\s+g/i.test(cleanSql) && /m\.IdMediaType\s*=\s*@type/i.test(cleanSql)) {
      const games = this.getTableRows('Games');
      const gameMap = new Map(games.map(g => [Number(g.IdGame), g]));
      const media = this.getTableRows('Media').filter(m => {
        if (Number(m.IdMediaType) !== Number(params.type)) return false;
        const g = gameMap.get(Number(m.IdGame));
        return g && Number(g.Disabled ?? 0) === 0;
      });

      const results = media.slice(0, 6).map(m => {
        const g = gameMap.get(Number(m.IdGame))!;
        return {
          ...m,
          NameGame: g.NameGame,
          Price: g.Price,
        };
      });
      return results as unknown as T[];
    }

    // 12. Media by Game: SELECT m.*, mt.MediaTypeName FROM [Media] m JOIN [MediaType] mt ON mt.IdMediaType = m.IdMediaType WHERE m.IdGame = @id AND m.IdMediaType != @screenshotType
    if (/FROM\s+\[Media\]\s+m\s+JOIN\s+\[MediaType\]\s+mt/i.test(cleanSql) && /m\.IdGame\s*=\s*@id/i.test(cleanSql)) {
      const mediaTypes = this.getTableRows('MediaType');
      const mtMap = new Map(mediaTypes.map(mt => [Number(mt.IdMediaType), mt]));
      const media = this.getTableRows('Media').filter(m =>
        Number(m.IdGame) === Number(params.id) && Number(m.IdMediaType) !== Number(params.screenshotType),
      );

      return media.map(m => {
        const mt = mtMap.get(Number(m.IdMediaType));
        return {
          ...m,
          MediaTypeName: mt?.MediaTypeName ?? '',
        };
      }) as unknown as T[];
    }

    return [];
  }
}
