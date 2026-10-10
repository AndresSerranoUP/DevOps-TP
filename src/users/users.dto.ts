import { IsEmail, IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class UserCreateDto {
  @IsEmail()
  emailUser!: string;

  @IsString()
  @IsNotEmpty()
  passwordUser!: string;

  @IsString()
  @IsNotEmpty()
  usernameUser!: string;

  @IsOptional()
  @IsString()
  imgAvatar?: string;

  // Legacy aliases
  get EmailUser(): string { return this.emailUser; }
  set EmailUser(v: string) { this.emailUser = v; }

  get PasswordUser(): string { return this.passwordUser; }
  set PasswordUser(v: string) { this.passwordUser = v; }

  get UsernameUser(): string { return this.usernameUser; }
  set UsernameUser(v: string) { this.usernameUser = v; }

  get ImgAvatar(): string | undefined { return this.imgAvatar; }
  set ImgAvatar(v: string | undefined) { this.imgAvatar = v; }
}

export class UserUpdateDto {
  @IsOptional()
  @IsInt()
  idUser?: number;

  @IsOptional()
  @IsEmail()
  emailUser?: string;

  @IsOptional()
  @IsString()
  usernameUser?: string;

  @IsOptional()
  @IsString()
  imgAvatar?: string;

  // Legacy aliases
  get IdUser(): number | undefined { return this.idUser; }
  set IdUser(v: number | undefined) { this.idUser = v; }

  get EmailUser(): string | undefined { return this.emailUser; }
  set EmailUser(v: string | undefined) { this.emailUser = v; }

  get UsernameUser(): string | undefined { return this.usernameUser; }
  set UsernameUser(v: string | undefined) { this.usernameUser = v; }

  get ImgAvatar(): string | undefined { return this.imgAvatar; }
  set ImgAvatar(v: string | undefined) { this.imgAvatar = v; }
}
