import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import { AppConfig } from '../config/app-config';
import {
  DataStore,
  DuplicateKeyError,
  ForeignKeyError,
  Row,
  SelectQuery,
  Where,
  UnknownTableOrColumnError,
} from './data-store';
import { SCHEMA } from './schema';

@Injectable()
export class SqliteDataStore extends DataStore implements OnModuleDestroy {
  private dbInstance?: Database.Database;
  private customDb?: string | Database.Database;
  private tableInfoCache: Map<
    string,
    Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>
  > = new Map();

  constructor(@Optional() private readonly appConfig?: AppConfig) {
    super();
  }

  setDatabase(db: string | Database.Database): void {
    if (this.dbInstance && this.dbInstance.open) {
      this.dbInstance.close();
    }
    this.customDb = db;
    this.dbInstance = undefined;
    this.tableInfoCache.clear();
  }

  get db(): Database.Database {
    if (!this.dbInstance) {
      if (this.customDb && typeof this.customDb !== 'string') {
        this.dbInstance = this.customDb;
      } else {
        const rawPath =
          typeof this.customDb === 'string'
            ? this.customDb
            : this.appConfig?.sqliteDbPath || process.env.SQLITE_DB_PATH || 'data/database.sqlite3';
        const resolvedPath = rawPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), rawPath);
        this.dbInstance = new Database(resolvedPath);
      }
      this.dbInstance.pragma('foreign_keys = ON');
    }
    return this.dbInstance;
  }

  private validateTable(table: string): void {
    if (!SCHEMA[table]) {
      throw new UnknownTableOrColumnError(`Unknown table: ${table}`);
    }
  }

  private getTableInfo(table: string) {
    const lower = table.toLowerCase();
    const cached = this.tableInfoCache.get(lower);
    if (cached) return cached;
    const info = this.db.prepare(`PRAGMA table_info([${table}])`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;
    this.tableInfoCache.set(lower, info);
    return info;
  }

  private sanitizeValue(val: unknown): unknown {
    if (val === undefined || val === null) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val instanceof Date) return val.toISOString();
    return val;
  }

  private mapError(error: any): never {
    if (
      error instanceof DuplicateKeyError ||
      error instanceof ForeignKeyError ||
      error instanceof UnknownTableOrColumnError
    ) {
      throw error;
    }
    if (error && typeof error === 'object') {
      const code = String(error.code || '');
      const message = String(error.message || '');
      if (
        code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        code.includes('UNIQUE') ||
        code.includes('PRIMARYKEY') ||
        message.includes('UNIQUE constraint failed') ||
        message.includes('PRIMARY KEY constraint failed')
      ) {
        throw new DuplicateKeyError(message, error);
      }
      if (
        code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
        code.includes('FOREIGNKEY') ||
        message.includes('FOREIGN KEY constraint failed')
      ) {
        throw new ForeignKeyError(message, error);
      }
      if (
        code === 'SQLITE_ERROR' &&
        (message.includes('no such table') || message.includes('no such column'))
      ) {
        throw new UnknownTableOrColumnError(message, error);
      }
    }
    throw error;
  }

  private buildWhereClause(
    table: string,
    where: Where | undefined,
    params: any[],
    prefixTable = true,
  ): string {
    if (!where) return '';

    const conditions: string[] = [];

    const formatCol = (colName: string): string => {
      if (colName.includes('.')) return colName;
      return prefixTable ? `[${table}].[${colName}]` : `[${colName}]`;
    };

    if (Array.isArray(where)) {
      for (const cond of where) {
        const col = formatCol(cond.column);
        const op = cond.operator || '=';
        const upperOp = op.toUpperCase();

        if (cond.value === null) {
          if (upperOp === '=' || upperOp === 'IS') {
            conditions.push(`${col} IS NULL`);
          } else if (upperOp === '!=' || upperOp === '<>' || upperOp === 'IS NOT') {
            conditions.push(`${col} IS NOT NULL`);
          }
        } else if (upperOp === 'IN' && Array.isArray(cond.value)) {
          if (cond.value.length === 0) {
            conditions.push('1 = 0');
          } else {
            const placeholders = cond.value.map(() => '?').join(', ');
            conditions.push(`${col} IN (${placeholders})`);
            for (const item of cond.value) {
              params.push(this.sanitizeValue(item));
            }
          }
        } else if (upperOp === 'LIKE') {
          conditions.push(`${col} LIKE ?`);
          params.push(this.sanitizeValue(cond.value));
        } else {
          conditions.push(`${col} ${op} ?`);
          params.push(this.sanitizeValue(cond.value));
        }
      }
    } else {
      for (const [colName, val] of Object.entries(where)) {
        if (val === undefined) continue;
        const col = formatCol(colName);
        if (val === null) {
          conditions.push(`${col} IS NULL`);
        } else {
          conditions.push(`${col} = ?`);
          params.push(this.sanitizeValue(val));
        }
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  async select<T = Row>(query: SelectQuery): Promise<T[]> {
    this.validateTable(query.table);
    try {
      const cols =
        query.columns && query.columns.length > 0
          ? query.columns.map(c => (c.includes('.') ? c : `[${query.table}].[${c}]`)).join(', ')
          : `[${query.table}].*`;

      let joinStr = '';
      if (query.joins && query.joins.length > 0) {
        joinStr = query.joins
          .map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`)
          .join(' ');
      }

      const params: any[] = [];
      const whereStr = this.buildWhereClause(query.table, query.where, params, true);

      const tableDef = SCHEMA[query.table];
      const defaultOrderCol = tableDef?.pk[0] ?? '1';
      const isValidOrderCol = Boolean(query.orderBy && tableDef?.columns[query.orderBy]);
      const orderCol = isValidOrderCol ? query.orderBy! : defaultOrderCol;
      const asc = query.ascending !== false ? 'ASC' : 'DESC';
      const orderStr = `ORDER BY [${query.table}].[${orderCol}] ${asc}`;

      let paginationStr = '';
      if (query.offset !== undefined && query.limit !== undefined) {
        paginationStr = 'LIMIT ? OFFSET ?';
        params.push(query.limit, query.offset);
      } else if (query.limit !== undefined) {
        paginationStr = 'LIMIT ?';
        params.push(query.limit);
      } else if (query.offset !== undefined) {
        paginationStr = 'LIMIT -1 OFFSET ?';
        params.push(query.offset);
      }

      const sqlParts = [
        `SELECT ${cols} FROM [${query.table}]`,
        joinStr,
        whereStr,
        orderStr,
        paginationStr,
      ].filter(Boolean);

      const sqlStr = sqlParts.join(' ');
      const rows = this.db.prepare(sqlStr).all(...params);
      return rows as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async count(
    queryOrTable: Pick<SelectQuery, 'table' | 'where' | 'joins'> | string,
    whereArg?: Where,
  ): Promise<number> {
    const table = typeof queryOrTable === 'string' ? queryOrTable : queryOrTable.table;
    const where = typeof queryOrTable === 'string' ? whereArg : queryOrTable.where;
    const joins = typeof queryOrTable === 'string' ? undefined : queryOrTable.joins;

    this.validateTable(table);
    try {
      const params: any[] = [];
      const whereStr = this.buildWhereClause(table, where, params, true);
      let joinStr = '';
      if (joins && joins.length > 0) {
        joinStr = joins.map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`).join(' ');
      }

      const sqlParts = [`SELECT COUNT(*) AS [total] FROM [${table}]`, joinStr, whereStr].filter(
        Boolean,
      );
      const sqlStr = sqlParts.join(' ');
      const result = this.db.prepare(sqlStr).get(...params) as { total: number };
      return Number(result?.total ?? 0);
    } catch (err) {
      return this.mapError(err);
    }
  }

  async insert<T = Row>(table: string, values: Record<string, unknown>): Promise<T> {
    this.validateTable(table);
    try {
      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      if (validKeys.length === 0) {
        throw new Error('At least one value is required for insert');
      }

      const tableDef = SCHEMA[table];
      const insertValues: Record<string, any> = { ...values };

      // Handle identity auto-generation if column is omitted
      if (
        tableDef?.identity &&
        (insertValues[tableDef.identity] === undefined || insertValues[tableDef.identity] === null)
      ) {
        const tableInfo = this.getTableInfo(table);
        const colInfo = tableInfo.find(
          c => c.name.toLowerCase() === tableDef.identity!.toLowerCase(),
        );
        const isAuto = colInfo && colInfo.pk > 0 && colInfo.type.toUpperCase() === 'INTEGER';
        if (!isAuto) {
          const maxRow = this.db
            .prepare(`SELECT MAX([${tableDef.identity}]) AS maxId FROM [${table}]`)
            .get() as { maxId: number | null };
          insertValues[tableDef.identity] = (maxRow?.maxId ?? 0) + 1;
        }
      }

      // Pre-check duplicate primary keys defensively if all PKs are supplied
      if (tableDef?.pk && tableDef.pk.length > 0) {
        const pkCols = tableDef.pk;
        const allSupplied = pkCols.every(
          c => insertValues[c] !== undefined && insertValues[c] !== null,
        );
        if (allSupplied) {
          const pkCond = pkCols.map(c => `[${c}] = ?`).join(' AND ');
          const pkVals = pkCols.map(c => this.sanitizeValue(insertValues[c]));
          const existing = this.db.prepare(`SELECT 1 FROM [${table}] WHERE ${pkCond}`).get(...pkVals);
          if (existing) {
            throw new DuplicateKeyError(`Duplicate primary key for table ${table}`);
          }
        }
      }

      // Pre-check foreign keys defensively if defined in schema
      if (tableDef?.fks) {
        for (const [fkCol, fkDef] of Object.entries(tableDef.fks)) {
          const val = insertValues[fkCol];
          if (val !== undefined && val !== null) {
            const parent = this.db
              .prepare(`SELECT 1 FROM [${fkDef.table}] WHERE [${fkDef.column}] = ?`)
              .get(this.sanitizeValue(val));
            if (!parent) {
              throw new ForeignKeyError(
                `Foreign key violation on ${table}.${fkCol} -> ${fkDef.table}.${fkDef.column}`,
              );
            }
          }
        }
      }

      const keysToInsert = Object.keys(insertValues).filter(k => insertValues[k] !== undefined);
      const colNames = keysToInsert.map(k => `[${k}]`).join(', ');
      const placeholders = keysToInsert.map(() => '?').join(', ');
      const params = keysToInsert.map(k => this.sanitizeValue(insertValues[k]));

      const sqlStr = `INSERT INTO [${table}] (${colNames}) VALUES (${placeholders})`;
      const result = this.db.prepare(sqlStr).run(...params);

      const inserted = this.db
        .prepare(`SELECT * FROM [${table}] WHERE rowid = ?`)
        .get(result.lastInsertRowid);
      return inserted as T;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async update<T = Row>(table: string, where: Where, values: Record<string, unknown>): Promise<T[]> {
    this.validateTable(table);
    try {
      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      if (validKeys.length === 0) {
        return this.select<T>({ table, where });
      }

      const params: any[] = [];
      const setAssignments: string[] = [];
      for (const k of validKeys) {
        setAssignments.push(`[${k}] = ?`);
        params.push(this.sanitizeValue(values[k]));
      }

      const whereStr = this.buildWhereClause(table, where, params, false);
      const sqlStr = `UPDATE [${table}] SET ${setAssignments.join(', ')} ${whereStr} RETURNING *`;
      const rows = this.db.prepare(sqlStr).all(...params);
      return rows as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async delete(table: string, where: Where): Promise<number> {
    this.validateTable(table);
    try {
      const params: any[] = [];
      const whereStr = this.buildWhereClause(table, where, params, false);
      const sqlStr = `DELETE FROM [${table}] ${whereStr}`;
      const result = this.db.prepare(sqlStr).run(...params);
      return result.changes;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async transaction<T>(work: (tx: DataStore) => Promise<T>): Promise<T> {
    const isNested = this.db.inTransaction;
    const savepoint = isNested
      ? `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;

    if (savepoint) {
      this.db.exec(`SAVEPOINT ${savepoint}`);
    } else {
      this.db.exec('BEGIN IMMEDIATE');
    }

    try {
      const result = await work(this);
      if (savepoint) {
        this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      } else {
        this.db.exec('COMMIT');
      }
      return result;
    } catch (err) {
      if (savepoint) {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      } else {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure if already rolled back
        }
      }
      throw err;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const row = this.db.prepare('SELECT 1 AS [ok]').get() as { ok: number };
      return row?.ok === 1;
    } catch {
      return false;
    }
  }

  private convertTsqlToSqlite(sqlText: string): string {
    let s = sqlText.trim();
    s = s.replace(/\bNEWID\(\)/gi, 'RANDOM()');

    const topMatch = s.match(
      /^SELECT\s+TOP\s+(?:\(([^)]+)\)|(\S+))\s+([\s\S]+?)\s+FROM\s+([\s\S]+)$/i,
    );
    if (topMatch) {
      const limitExpr = topMatch[1] || topMatch[2];
      const selectCols = topMatch[3];
      const fromAndRest = topMatch[4];
      s = `SELECT ${selectCols} FROM ${fromAndRest} LIMIT ${limitExpr}`;
    }
    return s;
  }

  async query<T = Row>(sqlText: string, params: Record<string, any> = {}): Promise<T[]> {
    try {
      const convertedSql = this.convertTsqlToSqlite(sqlText);
      const cleanParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        const cleanKey = key.startsWith('@') ? key.slice(1) : key;
        const unwrapVal =
          value && typeof value === 'object' && 'value' in value ? value.value : value;
        cleanParams[cleanKey] = this.sanitizeValue(unwrapVal);
      }

      const stmt = this.db.prepare(convertedSql);
      const hasParams = Object.keys(cleanParams).length > 0;

      if (stmt.reader) {
        const rows = hasParams ? stmt.all(cleanParams) : stmt.all();
        return rows as T[];
      } else {
        const info = hasParams ? stmt.run(cleanParams) : stmt.run();
        return [{ changes: info.changes, lastInsertRowid: info.lastInsertRowid }] as unknown as T[];
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  onModuleDestroy(): void {
    if (this.dbInstance && this.dbInstance.open) {
      this.dbInstance.close();
      this.dbInstance = undefined;
    }
  }
}
