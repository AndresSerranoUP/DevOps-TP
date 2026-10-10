import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  get port(): number {
    return Number(this.config.get('PORT', 3000));
  }

  get jwt(): { secret: string; issuer?: string; subject: string; expiresIn: number } {
    return {
      secret: this.config.get<string>('JWT_SECRET') ?? '',
      issuer: this.jwtIssuer,
      subject: this.jwtSubject,
      expiresIn: this.jwtExpirationMinutes * 60,
    };
  }

  get jwtSecret(): string {
    return this.required('JWT_SECRET');
  }

  get jwtExpirationMinutes(): number {
    return Number(this.config.get('JWT_EXPIRATION_MINUTES', 60));
  }

  get jwtIssuer(): string | undefined {
    return this.config.get<string>('JWT_ISSUER');
  }

  get jwtSubject(): string {
    return this.config.get<string>('JWT_SUBJECT', 'MySub');
  }

  get encrypterKey(): string {
    return this.required('ENCRYPTER_KEY');
  }

  get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  get publicApiUrl(): string {
    return this.config.get<string>('PUBLIC_API_URL', 'http://localhost:3000/api');
  }

  get dbServer(): string | undefined {
    return this.config.get<string>('DB_SERVER');
  }

  get dbPort(): number {
    return Number(this.config.get('DB_PORT', 1433));
  }

  get dbDatabase(): string | undefined {
    return this.config.get<string>('DB_DATABASE');
  }

  get dbUser(): string | undefined {
    return this.config.get<string>('DB_USER');
  }

  get dbPassword(): string | undefined {
    return this.config.get<string>('DB_PASSWORD');
  }

  get dbEncrypt(): boolean {
    return this.config.get<string>('DB_ENCRYPT', 'true') === 'true';
  }

  get dbTrustServerCertificate(): boolean {
    return this.config.get<string>('DB_TRUST_SERVER_CERTIFICATE', 'false') === 'true';
  }

  get dbConfig() {
    const server = this.dbServer;
    const database = this.dbDatabase;
    const user = this.dbUser;
    const password = this.dbPassword;
    if (!server || !database || !user || !password) {
      throw new Error('Azure SQL configuration is incomplete');
    }
    return {
      server,
      database,
      user,
      password,
      port: this.dbPort,
      options: {
        encrypt: this.dbEncrypt,
        trustServerCertificate: this.dbTrustServerCertificate,
      },
    };
  }
}
