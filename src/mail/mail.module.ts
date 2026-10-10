import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { StubMailService } from './stub-mail.service';

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      useClass: StubMailService,
    },
    StubMailService,
  ],
  exports: [MailService, StubMailService],
})
export class MailModule {}
