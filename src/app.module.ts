import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/config.module';
import { StoreModule } from './store/store.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DevelopersModule } from './developers/developers.module';
import { DeveloperUsersModule } from './developer-users/developer-users.module';
import { GenresModule } from './genres/genres.module';
import { RolesModule } from './roles/roles.module';
import { SocialLinksModule } from './social-links/social-links.module';
import { GamesModule } from './games/games.module';
import { MediaModule } from './media/media.module';
import { UserGamesModule } from './user-games/user-games.module';
import { HealthModule } from './health/health.module';
import { OptionalAuthMiddleware } from './auth/optional-auth.middleware';

@Module({
  imports: [
    AppConfigModule,
    StoreModule,
    MailModule,
    AuthModule,
    UsersModule,
    DevelopersModule,
    DeveloperUsersModule,
    GenresModule,
    RolesModule,
    SocialLinksModule,
    GamesModule,
    MediaModule,
    UserGamesModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OptionalAuthMiddleware).forRoutes('*');
  }
}
