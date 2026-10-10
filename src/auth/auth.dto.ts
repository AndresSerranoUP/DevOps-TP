import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  emailUser!: string;

  @IsString()
  @IsNotEmpty()
  passwordUser!: string;

  // Aliases for legacy clients
  get EmailUser(): string {
    return this.emailUser;
  }
  set EmailUser(v: string) {
    this.emailUser = v;
  }

  get PasswordUser(): string {
    return this.passwordUser;
  }
  set PasswordUser(v: string) {
    this.passwordUser = v;
  }
}
