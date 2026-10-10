export class DuplicateKeyError extends Error {
  constructor(message = 'Duplicate key violation', public readonly originalError?: unknown) {
    super(message);
    this.name = 'DuplicateKeyError';
  }
}

export class ForeignKeyError extends Error {
  constructor(message = 'Foreign key constraint violation', public readonly originalError?: unknown) {
    super(message);
    this.name = 'ForeignKeyError';
  }
}

export class UnknownTableOrColumnError extends Error {
  constructor(message = 'Unknown table or column', public readonly originalError?: unknown) {
    super(message);
    this.name = 'UnknownTableOrColumnError';
  }
}

export type Row = Record<string, any>;

export interface WhereCondition {
  column: string;
  operator?: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN';
  value: unknown;
}

export type Where = Record<string, unknown> | WhereCondition[];

export interface SelectJoin {
  type?: 'INNER' | 'LEFT' | 'RIGHT';
  table: string;
  on: string;
}

export interface SelectQuery {
  table: string;
  columns?: string[];
  where?: Where;
  orderBy?: string;
  ascending?: boolean;
  offset?: number;
  limit?: number;
  joins?: SelectJoin[];
}

export abstract class DataStore {
  abstract select<T = Row>(query: SelectQuery): Promise<T[]>;
  abstract count(query: Pick<SelectQuery, 'table' | 'where' | 'joins'>): Promise<number>;
  abstract insert<T = Row>(table: string, values: Record<string, unknown>): Promise<T>;
  abstract update<T = Row>(table: string, where: Where, values: Record<string, unknown>): Promise<T[]>;
  abstract delete(table: string, where: Where): Promise<number>;
  abstract transaction<T>(work: (store: DataStore) => Promise<T>): Promise<T>;
  abstract ping(): Promise<boolean>;
  abstract query<T = Row>(sql: string, params?: Record<string, any>): Promise<T[]>;
}
