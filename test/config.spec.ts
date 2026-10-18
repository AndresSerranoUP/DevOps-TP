import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../src/config/app-config';
import { AppConfigModule } from '../src/config/config.module';

describe('AppConfig & AppConfigModule', () => {
  it('uses Backend-compatible JWT defaults and all getters', () => {
    const config = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          JWT_SECRET: 'test-secret',
          JWT_SUBJECT: 'MySub',
          JWT_ISSUER: 'MyIssuer',
          JWT_EXPIRATION_MINUTES: '60',
          PORT: '3010',
          ENCRYPTER_KEY: 'test-key',
          FRONTEND_URL: 'http://frontend.com',
          PUBLIC_API_URL: 'http://api.com',
          DB_SERVER: 'sql.server',
          DB_TYPE: 'sqlite',
          SQLITE_DB_PATH: 'custom/db.sqlite3',
          DB_PORT: '1433',
          DB_DATABASE: 'mydb',
          DB_USER: 'sa',
          DB_PASSWORD: 'secretpassword',
          DB_ENCRYPT: 'false',
          DB_TRUST_SERVER_CERTIFICATE: 'true',
        };
        return values[key] !== undefined ? values[key] : defaultValue;
      }),
    } as unknown as ConfigService;

    const result = new AppConfig(config);
    expect(result.jwt).toEqual({ secret: 'test-secret', issuer: 'MyIssuer', subject: 'MySub', expiresIn: 3600 });
    expect(result.jwtSecret).toBe('test-secret');
    expect(result.jwtExpirationMinutes).toBe(60);
    expect(result.jwtIssuer).toBe('MyIssuer');
    expect(result.jwtSubject).toBe('MySub');
    expect(result.encrypterKey).toBe('test-key');
    expect(result.frontendUrl).toBe('http://frontend.com');
    expect(result.publicApiUrl).toBe('http://api.com');
    expect(result.port).toBe(3010);
    expect(result.dbServer).toBe('sql.server');
    expect(result.dbType).toBe('sqlite');
    expect(result.sqliteDbPath).toBe('custom/db.sqlite3');
    expect(result.dbPort).toBe(1433);
    expect(result.dbDatabase).toBe('mydb');
    expect(result.dbUser).toBe('sa');
    expect(result.dbPassword).toBe('secretpassword');
    expect(result.dbEncrypt).toBe(false);
    expect(result.dbTrustServerCertificate).toBe(true);

    const dbCfg = result.dbConfig;
    expect(dbCfg.server).toBe('sql.server');
    expect(dbCfg.database).toBe('mydb');
    expect(dbCfg.options.encrypt).toBe(false);
    expect(dbCfg.options.trustServerCertificate).toBe(true);
  });

  it('uses fallback defaults when optional env vars are missing', () => {
    const mockEmptyConfig = {
      get: jest.fn().mockImplementation((_key: string, defaultValue?: any) => defaultValue),
    } as unknown as ConfigService;

    const result = new AppConfig(mockEmptyConfig);
    expect(result.port).toBe(3000);
    expect(result.jwtExpirationMinutes).toBe(60);
    expect(result.jwtSubject).toBe('MySub');
    expect(result.jwtIssuer).toBeUndefined();
    expect(result.frontendUrl).toBe('http://localhost:3000');
    expect(result.publicApiUrl).toBe('http://localhost:3000/api');
    expect(result.dbPort).toBe(1433);
    expect(result.dbType).toBe('sqlite');
    expect(result.sqliteDbPath).toBe('data/database.sqlite3');
    expect(result.dbEncrypt).toBe(true);
    expect(result.dbTrustServerCertificate).toBe(false);
  });

  it('fails explicitly for missing secrets', () => {
    const mockEmptyConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const appConfig = new AppConfig(mockEmptyConfig);
    expect(() => appConfig.required('JWT_SECRET'))
      .toThrow('Missing required environment variable: JWT_SECRET');
    expect(() => appConfig.encrypterKey)
      .toThrow('Missing required environment variable: ENCRYPTER_KEY');
    expect(() => appConfig.jwtSecret)
      .toThrow('Missing required environment variable: JWT_SECRET');
  });

  it('throws error when dbConfig is incomplete', () => {
    const mockPartialConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'DB_SERVER') return 'server';
        return undefined;
      }),
    } as unknown as ConfigService;

    const incomplete = new AppConfig(mockPartialConfig);
    expect(() => incomplete.dbConfig).toThrow('Azure SQL configuration is incomplete');
  });

  it('AppConfigModule is defined', () => {
    expect(AppConfigModule).toBeDefined();
    const module = new AppConfigModule();
    expect(module).toBeInstanceOf(AppConfigModule);
  });
});
