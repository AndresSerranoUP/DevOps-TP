jest.mock('mssql', () => {
  const actual = jest.requireActual('mssql');
  return { ...actual, ConnectionPool: jest.fn() };
});

import * as sql from 'mssql';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../src/config/app-config';
import { SqlDataStore } from '../src/store/sql-data-store';

describe('SqlDataStore connection lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shares one lazy connection promise across concurrent callers', async () => {
    let resolve!: (pool: unknown) => void;
    const connecting = new Promise(resolvePool => { resolve = resolvePool; });
    const pool = { request: jest.fn() };
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => ({
      connect: () => connecting,
    }));
    const config = new ConfigService({
      DB_SERVER: 'server', DB_DATABASE: 'database', DB_USER: 'user', DB_PASSWORD: 'password',
    });
    const appConfig = new AppConfig(config);
    const store = new SqlDataStore(appConfig);
    const first = (store as never as { connection: () => Promise<unknown> }).connection();
    const second = (store as never as { connection: () => Promise<unknown> }).connection();
    expect(sql.ConnectionPool).toHaveBeenCalledTimes(1);
    resolve(pool);
    await expect(Promise.all([first, second])).resolves.toEqual([pool, pool]);
  });

  it('clears a rejected connection so the next operation can retry', async () => {
    const failed = Promise.reject(new Error('connection failed'));
    const pool = { connect: jest.fn().mockResolvedValue({}) };
    (sql.ConnectionPool as unknown as jest.Mock)
      .mockImplementationOnce(() => ({ connect: () => failed }))
      .mockImplementationOnce(() => pool);
    const config = new ConfigService({
      DB_SERVER: 'server', DB_DATABASE: 'database', DB_USER: 'user', DB_PASSWORD: 'password',
    });
    const appConfig = new AppConfig(config);
    const store = new SqlDataStore(appConfig);
    const connection = (store as never as { connection: () => Promise<unknown> }).connection;
    await expect(connection.call(store)).rejects.toThrow('connection failed');
    await expect(connection.call(store)).resolves.toEqual({});
    expect(sql.ConnectionPool).toHaveBeenCalledTimes(2);
  });

  it('safely falls back to primary key when orderBy is invalid or contains SQL injection', async () => {
    let capturedQuery = '';
    const requestMock = {
      input: jest.fn(),
      query: jest.fn().mockImplementation((q: string) => {
        capturedQuery = q;
        return Promise.resolve({ recordset: [] });
      }),
    };
    const pool = { request: () => requestMock };
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => ({
      connect: () => Promise.resolve(pool),
    }));
    const config = new ConfigService({ DB_SERVER: 's', DB_DATABASE: 'd', DB_USER: 'u', DB_PASSWORD: 'p' });
    const store = new SqlDataStore(new AppConfig(config));

    // Malicious SQL injection in orderBy
    await store.select({ table: 'Developers', orderBy: '1]; DROP TABLE Developers; --' });
    expect(capturedQuery).toContain('ORDER BY [IdDeveloper] ASC');

    // Valid column in orderBy
    await store.select({ table: 'Developers', orderBy: 'NameDeveloper', ascending: false });
    expect(capturedQuery).toContain('ORDER BY [NameDeveloper] DESC');
  });
});
