import { Global, Module } from '@nestjs/common';
import { DataStore } from './data-store';
import { SqlDataStore } from './sql-data-store';

@Global()
@Module({
  providers: [
    {
      provide: DataStore,
      useClass: SqlDataStore,
    },
    SqlDataStore,
  ],
  exports: [DataStore, SqlDataStore],
})
export class StoreModule {}
