export abstract class MailService {
  abstract sendVerificationEmail(to: string, verificationUrl: string): Promise<void>;
  abstract sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
}
