import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';
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
export class SqlDataStore extends DataStore implements OnModuleDestroy {
  private poolPromise?: Promise<sql.ConnectionPool>;

  constructor(private readonly appConfig: AppConfig) {
    super();
  }

  private async connection(): Promise<sql.ConnectionPool> {
    if (!this.poolPromise) {
      const cfg = this.appConfig.dbConfig;
      const pool = new sql.ConnectionPool({
        server: cfg.server,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        port: cfg.port,
        options: cfg.options,
      });

      const pending = pool.connect();
      this.poolPromise = pending;
      try {
        return await pending;
      } catch (error) {
        if (this.poolPromise === pending) {
          this.poolPromise = undefined;
        }
        throw error;
      }
    }
    return this.poolPromise;
  }

  private validateTable(table: string): void {
    if (!SCHEMA[table]) {
      throw new UnknownTableOrColumnError(`Unknown table: ${table}`);
    }
  }

  private getSqlType(table: string, column: string, value: unknown): (() => sql.ISqlType) | sql.ISqlType {
    const tableDef = SCHEMA[table];
    if (tableDef && tableDef.columns[column]) {
      const type = tableDef.columns[column].type;
      switch (type) {
        case 'Int':
          return sql.Int;
        case 'Bit':
          return sql.Bit;
        case 'DateTime':
          return sql.DateTime2;
        case 'Decimal':
          return sql.Decimal(18, 2);
        default:
          return sql.NVarChar;
      }
    }
    if (typeof value === 'number') return Number.isInteger(value) ? sql.Int : sql.Decimal(18, 2);
    if (typeof value === 'boolean') return sql.Bit;
    if (value instanceof Date) return sql.DateTime2;
    return sql.NVarChar;
  }

  private mapError(error: any): never {
    if (error && typeof error === 'object') {
      const num = error.number;
      if (num === 2627 || num === 2601) {
        throw new DuplicateKeyError(error.message, error);
      }
      if (num === 547) {
        throw new ForeignKeyError(error.message, error);
      }
    }
    throw error;
  }

  private buildWhereClause(
    table: string,
    where: Where | undefined,
    request: sql.Request,
    paramPrefix = 'p_w_',
  ): string {
    if (!where) return '';

    const conditions: string[] = [];
    let idx = 0;

    if (Array.isArray(where)) {
      for (const cond of where) {
        const paramName = `${paramPrefix}${idx++}`;
        const op = cond.operator || '=';
        if (cond.value === null) {
          if (op === '=') conditions.push(`[${cond.column}] IS NULL`);
          else if (op === '!=') conditions.push(`[${cond.column}] IS NOT NULL`);
        } else if (op === 'IN' && Array.isArray(cond.value)) {
          const inParams = cond.value.map((v, i) => {
            const inPName = `${paramName}_${i}`;
            request.input(inPName, this.getSqlType(table, cond.column, v), v);
            return `@${inPName}`;
          });
          conditions.push(`[${cond.column}] IN (${inParams.join(',')})`);
        } else {
          request.input(paramName, this.getSqlType(table, cond.column, cond.value), cond.value);
          conditions.push(`[${cond.column}] ${op} @${paramName}`);
        }
      }
    } else {
      for (const [col, val] of Object.entries(where)) {
        if (val === undefined) continue;
        const paramName = `${paramPrefix}${idx++}`;
        if (val === null) {
          conditions.push(`[${col}] IS NULL`);
        } else {
          request.input(paramName, this.getSqlType(table, col, val), val);
          conditions.push(`[${col}]=@${paramName}`);
        }
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  async select<T = Row>(query: SelectQuery): Promise<T[]> {
    this.validateTable(query.table);
    try {
      const conn = await this.connection();
      const request = conn.request();

      let sqlStr = '';
      const cols = query.columns && query.columns.length > 0
        ? query.columns.map(c => `[${query.table}].[${c}]`).join(', ')
        : `[${query.table}].*`;

      let joinStr = '';
      if (query.joins && query.joins.length > 0) {
        joinStr = query.joins
          .map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`)
          .join(' ');
      }

      const whereStr = this.buildWhereClause(query.table, query.where, request);

      const tableDef = SCHEMA[query.table];
      const defaultOrderCol = tableDef?.pk[0] ?? '1';
      const isValidOrderCol = Boolean(query.orderBy && tableDef?.columns[query.orderBy]);
      const orderCol = isValidOrderCol ? query.orderBy! : defaultOrderCol;
      const asc = query.ascending !== false ? 'ASC' : 'DESC';
      const orderStr = `ORDER BY [${orderCol}] ${asc}`;

      if (query.offset !== undefined && query.limit !== undefined) {
        request.input('p_offset', sql.Int, query.offset);
        request.input('p_limit', sql.Int, query.limit);
        sqlStr = `SELECT ${cols} FROM [${query.table}] ${joinStr} ${whereStr} ${orderStr} OFFSET @p_offset ROWS FETCH NEXT @p_limit ROWS ONLY`;
      } else if (query.limit !== undefined) {
        request.input('p_limit', sql.Int, query.limit);
        sqlStr = `SELECT TOP (@p_limit) ${cols} FROM [${query.table}] ${joinStr} ${whereStr} ${orderStr}`;
      } else {
        sqlStr = `SELECT ${cols} FROM [${query.table}] ${joinStr} ${whereStr} ${orderStr}`;
      }

      const result = await request.query(sqlStr);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async count(query: Pick<SelectQuery, 'table' | 'where' | 'joins'>): Promise<number> {
    this.validateTable(query.table);
    try {
      const conn = await this.connection();
      const request = conn.request();

      let joinStr = '';
      if (query.joins && query.joins.length > 0) {
        joinStr = query.joins
          .map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`)
          .join(' ');
      }

      const whereStr = this.buildWhereClause(query.table, query.where, request);
      const sqlStr = `SELECT COUNT(*) AS [total] FROM [${query.table}] ${joinStr} ${whereStr}`;

      const result = await request.query(sqlStr);
      return Number(result.recordset[0]?.total ?? 0);
    } catch (err) {
      return this.mapError(err);
    }
  }

  async insert<T = Row>(table: string, values: Record<string, unknown>): Promise<T> {
    this.validateTable(table);
    try {
      const conn = await this.connection();
      const request = conn.request();

      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      if (validKeys.length === 0) {
        throw new Error('At least one value is required for insert');
      }

      for (const k of validKeys) {
        request.input(k, this.getSqlType(table, k, values[k]), values[k]);
      }

      const colNames = validKeys.map(k => `[${k}]`).join(', ');
      const paramNames = validKeys.map(k => `@${k}`).join(', ');

      const sqlStr = `INSERT INTO [${table}] (${colNames}) OUTPUT INSERTED.* VALUES (${paramNames})`;
      const result = await request.query(sqlStr);
      return result.recordset[0] as T;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async update<T = Row>(table: string, where: Where, values: Record<string, unknown>): Promise<T[]> {
    this.validateTable(table);
    try {
      const conn = await this.connection();
      const request = conn.request();

      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      if (validKeys.length === 0) {
        return this.select<T>({ table, where });
      }

      const setAssignments: string[] = [];
      for (const k of validKeys) {
        const paramName = `upd_${k}`;
        request.input(paramName, this.getSqlType(table, k, values[k]), values[k]);
        setAssignments.push(`[${k}]=@${paramName}`);
      }

      const whereStr = this.buildWhereClause(table, where, request, 'upd_w_');
      const sqlStr = `UPDATE [${table}] SET ${setAssignments.join(', ')} OUTPUT INSERTED.* ${whereStr}`;

      const result = await request.query(sqlStr);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async delete(table: string, where: Where): Promise<number> {
    this.validateTable(table);
    try {
      const conn = await this.connection();
      const request = conn.request();

      const whereStr = this.buildWhereClause(table, where, request, 'del_w_');
      const sqlStr = `DELETE FROM [${table}] ${whereStr}`;

      const result = await request.query(sqlStr);
      return result.rowsAffected[0] ?? 0;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async transaction<T>(work: (store: DataStore) => Promise<T>): Promise<T> {
    const conn = await this.connection();
    const tx = new sql.Transaction(conn);
    await tx.begin();
    try {
      const txStore = new TransactionalSqlDataStore(tx, this.appConfig);
      const res = await work(txStore);
      await tx.commit();
      return res;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const conn = await this.connection();
      const result = await conn.request().query('SELECT 1 AS [ok]');
      return result.recordset[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async query<T = Row>(sqlText: string, params: Record<string, any> = {}): Promise<T[]> {
    try {
      const conn = await this.connection();
      const request = conn.request();

      for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
          request.input(key, (value as any).type, (value as any).value);
        } else {
          request.input(key, value);
        }
      }

      const result = await request.query(sqlText);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const pool = await this.poolPromise;
    this.poolPromise = undefined;
    await pool?.close();
  }
}

class TransactionalSqlDataStore extends DataStore {
  constructor(private readonly tx: sql.Transaction, private readonly appConfig: AppConfig) {
    super();
  }

  private validateTable(table: string): void {
    if (!SCHEMA[table]) {
      throw new UnknownTableOrColumnError(`Unknown table: ${table}`);
    }
  }

  private getSqlType(table: string, column: string, value: unknown): (() => sql.ISqlType) | sql.ISqlType {
    const tableDef = SCHEMA[table];
    if (tableDef && tableDef.columns[column]) {
      const type = tableDef.columns[column].type;
      switch (type) {
        case 'Int': return sql.Int;
        case 'Bit': return sql.Bit;
        case 'DateTime': return sql.DateTime2;
        case 'Decimal': return sql.Decimal(18, 2);
        default: return sql.NVarChar;
      }
    }
    if (typeof value === 'number') return Number.isInteger(value) ? sql.Int : sql.Decimal(18, 2);
    if (typeof value === 'boolean') return sql.Bit;
    if (value instanceof Date) return sql.DateTime2;
    return sql.NVarChar;
  }

  private mapError(error: any): never {
    if (error && typeof error === 'object') {
      const num = error.number;
      if (num === 2627 || num === 2601) {
        throw new DuplicateKeyError(error.message, error);
      }
      if (num === 547) {
        throw new ForeignKeyError(error.message, error);
      }
    }
    throw error;
  }

  private buildWhereClause(table: string, where: Where | undefined, request: sql.Request, paramPrefix = 'p_w_'): string {
    if (!where) return '';
    const conditions: string[] = [];
    let idx = 0;
    if (Array.isArray(where)) {
      for (const cond of where) {
        const paramName = `${paramPrefix}${idx++}`;
        const op = cond.operator || '=';
        if (cond.value === null) {
          if (op === '=') conditions.push(`[${cond.column}] IS NULL`);
          else if (op === '!=') conditions.push(`[${cond.column}] IS NOT NULL`);
        } else {
          request.input(paramName, this.getSqlType(table, cond.column, cond.value), cond.value);
          conditions.push(`[${cond.column}] ${op} @${paramName}`);
        }
      }
    } else {
      for (const [col, val] of Object.entries(where)) {
        if (val === undefined) continue;
        const paramName = `${paramPrefix}${idx++}`;
        if (val === null) {
          conditions.push(`[${col}] IS NULL`);
        } else {
          request.input(paramName, this.getSqlType(table, col, val), val);
          conditions.push(`[${col}]=@${paramName}`);
        }
      }
    }
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  async select<T = Row>(query: SelectQuery): Promise<T[]> {
    this.validateTable(query.table);
    try {
      const request = new sql.Request(this.tx);
      const cols = query.columns && query.columns.length > 0
        ? query.columns.map(c => `[${query.table}].[${c}]`).join(', ')
        : `[${query.table}].*`;
      let joinStr = '';
      if (query.joins && query.joins.length > 0) {
        joinStr = query.joins.map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`).join(' ');
      }
      const whereStr = this.buildWhereClause(query.table, query.where, request);
      const tableDef = SCHEMA[query.table];
      const defaultOrderCol = tableDef?.pk[0] ?? '1';
      const isValidOrderCol = Boolean(query.orderBy && tableDef?.columns[query.orderBy]);
      const orderCol = isValidOrderCol ? query.orderBy! : defaultOrderCol;
      const asc = query.ascending !== false ? 'ASC' : 'DESC';
      const orderStr = `ORDER BY [${orderCol}] ${asc}`;
      const sqlStr = `SELECT ${cols} FROM [${query.table}] ${joinStr} ${whereStr} ${orderStr}`;
      const result = await request.query(sqlStr);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async count(query: Pick<SelectQuery, 'table' | 'where' | 'joins'>): Promise<number> {
    this.validateTable(query.table);
    try {
      const request = new sql.Request(this.tx);
      let joinStr = '';
      if (query.joins && query.joins.length > 0) {
        joinStr = query.joins.map(j => `${j.type || 'INNER'} JOIN [${j.table}] ON ${j.on}`).join(' ');
      }
      const whereStr = this.buildWhereClause(query.table, query.where, request);
      const sqlStr = `SELECT COUNT(*) AS [total] FROM [${query.table}] ${joinStr} ${whereStr}`;
      const result = await request.query(sqlStr);
      return Number(result.recordset[0]?.total ?? 0);
    } catch (err) {
      return this.mapError(err);
    }
  }

  async insert<T = Row>(table: string, values: Record<string, unknown>): Promise<T> {
    this.validateTable(table);
    try {
      const request = new sql.Request(this.tx);
      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      for (const k of validKeys) {
        request.input(k, this.getSqlType(table, k, values[k]), values[k]);
      }
      const colNames = validKeys.map(k => `[${k}]`).join(', ');
      const paramNames = validKeys.map(k => `@${k}`).join(', ');
      const sqlStr = `INSERT INTO [${table}] (${colNames}) OUTPUT INSERTED.* VALUES (${paramNames})`;
      const result = await request.query(sqlStr);
      return result.recordset[0] as T;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async update<T = Row>(table: string, where: Where, values: Record<string, unknown>): Promise<T[]> {
    this.validateTable(table);
    try {
      const request = new sql.Request(this.tx);
      const validKeys = Object.keys(values).filter(k => values[k] !== undefined);
      if (validKeys.length === 0) return this.select<T>({ table, where });
      const setAssignments: string[] = [];
      for (const k of validKeys) {
        const paramName = `upd_${k}`;
        request.input(paramName, this.getSqlType(table, k, values[k]), values[k]);
        setAssignments.push(`[${k}]=@${paramName}`);
      }
      const whereStr = this.buildWhereClause(table, where, request, 'upd_w_');
      const sqlStr = `UPDATE [${table}] SET ${setAssignments.join(', ')} OUTPUT INSERTED.* ${whereStr}`;
      const result = await request.query(sqlStr);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }

  async delete(table: string, where: Where): Promise<number> {
    this.validateTable(table);
    try {
      const request = new sql.Request(this.tx);
      const whereStr = this.buildWhereClause(table, where, request, 'del_w_');
      const sqlStr = `DELETE FROM [${table}] ${whereStr}`;
      const result = await request.query(sqlStr);
      return result.rowsAffected[0] ?? 0;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async transaction<T>(work: (store: DataStore) => Promise<T>): Promise<T> {
    return work(this);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async query<T = Row>(sqlText: string, params: Record<string, any> = {}): Promise<T[]> {
    try {
      const request = new sql.Request(this.tx);
      for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
          request.input(key, (value as any).type, (value as any).value);
        } else {
          request.input(key, value);
        }
      }
      const result = await request.query(sqlText);
      return result.recordset as T[];
    } catch (err) {
      return this.mapError(err);
    }
  }
}
