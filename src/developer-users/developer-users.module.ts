import { Module } from '@nestjs/common';
import { DeveloperUsersController } from './developer-users.controller';
import { DeveloperUsersService } from './developer-users.service';

@Module({
  controllers: [DeveloperUsersController],
  providers: [DeveloperUsersService],
  exports: [DeveloperUsersService],
})
export class DeveloperUsersModule {}
