import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Recomendado: prioriza .env.local sobre .env
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule { }
