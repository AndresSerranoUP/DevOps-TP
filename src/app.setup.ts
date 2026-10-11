import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { KeyNormalizePipe } from './common/http/key-normalize.pipe';
import { StoreExceptionFilter } from './common/http/store-exception.filter';
import { StructuredLoggerInterceptor } from './common/logging/structured-logger.interceptor';

export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: '*' });

  app.useGlobalInterceptors(new StructuredLoggerInterceptor());

  app.useGlobalPipes(
    new KeyNormalizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.useGlobalFilters(new StoreExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('GamingTrends API')
    .setDescription('Compatible API migrated from Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  return app;
}
