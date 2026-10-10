import { Injectable } from '@nestjs/common';
import { MailService } from './mail.service';
import { verificationEmail, passwordResetEmail } from './templates';

export interface OutboxEmail {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class StubMailService extends MailService {
  readonly outbox: OutboxEmail[] = [];

  async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    this.outbox.push({
      to,
      subject: 'Verify your email',
      body: verificationEmail(verificationUrl),
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.outbox.push({
      to,
      subject: 'Reset your password',
      body: passwordResetEmail(resetUrl),
    });
  }

  clear(): void {
    this.outbox.length = 0;
  }
}
