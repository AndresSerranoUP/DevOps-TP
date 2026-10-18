import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { DataStore } from './data-store';
import { SqlDataStore } from './sql-data-store';
import { SqliteDataStore } from './sqlite-data-store';
import { AppConfig } from '../config/app-config';

// Limpieza defensiva por si viene con comentarios como '# Opciones: ...'
const rawDbType = (process.env.DB_TYPE || '').split('#')[0].trim().toLowerCase();
const isSqlite = rawDbType === 'sqlite' || (!process.env.DB_SERVER && rawDbType !== 'azure');

@Global()
@Module({
  providers: [
    isSqlite
      ? {
        provide: DataStore,
        useClass: SqliteDataStore,
      }
      : {
        provide: DataStore,
        useClass: SqlDataStore,
      },
    SqliteDataStore,
    SqlDataStore,
  ],
  exports: [DataStore, SqliteDataStore, SqlDataStore],
})
export class StoreModule implements OnModuleInit {
  private readonly logger = new Logger('Database');

  constructor(
    private readonly dataStore: DataStore,
    private readonly appConfig: AppConfig,
  ) { }

  async onModuleInit(): Promise<void> {
    const dbType = this.appConfig.dbType;
    this.logger.log(`Verificando conectividad con el motor de base de datos (${dbType})...`);

    try {
      // Ejecutamos una consulta directa de comprobación
      await this.dataStore.query('SELECT 1 AS [ok]');

      if (dbType === 'sqlite') {
        this.logger.log(`✅ Base de datos SQLite lista en: "${this.appConfig.sqliteDbPath}"`);
      } else {
        this.logger.log(`✅ Base de datos SQL Server conectada en: ${this.appConfig.dbServer}:${this.appConfig.dbPort}/${this.appConfig.dbDatabase}`);
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error crítico de conexión a la base de datos (${dbType}): ${error.message}`,
        error.stack,
      );
      // Si deseas que el contenedor falle inmediatamente y no arranque con DB caída, descomenta:
      // throw error;
    }
  }
}