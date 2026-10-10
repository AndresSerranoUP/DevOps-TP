import { StubMailService } from '../src/mail/stub-mail.service';
import { MailModule } from '../src/mail/mail.module';
import { verificationEmail, passwordResetEmail, passwordChangedHtml } from '../src/mail/templates';

describe('Mail module unit tests', () => {
  it('StubMailService sends verification email and records to outbox', async () => {
    const service = new StubMailService();
    await service.sendVerificationEmail('user@test.com', 'https://verify.url/abc');

    expect(service.outbox).toHaveLength(1);
    expect(service.outbox[0]).toEqual({
      to: 'user@test.com',
      subject: 'Verify your email',
      body: verificationEmail('https://verify.url/abc'),
    });
  });

  it('StubMailService sends password reset email and records to outbox', async () => {
    const service = new StubMailService();
    await service.sendPasswordResetEmail('user@test.com', 'https://reset.url/abc');

    expect(service.outbox).toHaveLength(1);
    expect(service.outbox[0]).toEqual({
      to: 'user@test.com',
      subject: 'Reset your password',
      body: passwordResetEmail('https://reset.url/abc'),
    });
  });

  it('StubMailService clear() empties outbox', async () => {
    const service = new StubMailService();
    await service.sendVerificationEmail('a@b.com', 'url');
    expect(service.outbox.length).toBe(1);
    service.clear();
    expect(service.outbox.length).toBe(0);
  });

  it('generates email templates properly', () => {
    const verify = verificationEmail('https://verify.link');
    expect(verify).toContain('Please click the following link to verify your email address:');
    expect(verify).toContain('<a href="https://verify.link">https://verify.link</a>');

    const reset = passwordResetEmail('https://reset.link');
    expect(reset).toContain('Please click the following link to reset your password:');
    expect(reset).toContain('<a href="https://reset.link">https://reset.link</a>');

    const changed = passwordChangedHtml();
    expect(changed).toBe('<html><body>Password Changed!</body></html>');
  });

  it('MailModule is defined', () => {
    expect(MailModule).toBeDefined();
    const module = new MailModule();
    expect(module).toBeInstanceOf(MailModule);
  });
});
