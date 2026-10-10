import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataStore } from '../store/data-store';
import { AppConfig } from '../config/app-config';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { LoginDto } from './auth.dto';

export interface LoginResponse {
  idUser: number;
  emailUser: string;
  usernameUser: string;
  imgAvatar: string | null;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataStore: DataStore,
    private readonly appConfig: AppConfig,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const hashedPassword = this.passwordHasher.hash(dto.passwordUser, this.appConfig.encrypterKey);

    const users = await this.dataStore.query<any>(
      'SELECT TOP 1 * FROM [Users] WHERE [EmailUser]=@email AND [PasswordUser]=@password',
      {
        email: dto.emailUser,
        password: hashedPassword,
      },
    );

    const user = users[0];
    if (!user) {
      throw new UnauthorizedException('Las credenciales ingresadas son invalidas!');
    }

    if (user.IsVerified === false) {
      throw new UnauthorizedException('User needs to verify its email to login to this website!');
    }

    const devRows = await this.dataStore.query<any>(
      'SELECT TOP 1 d.* FROM [Developers] d JOIN [DevelopersUsers] du ON du.IdDeveloper=d.IdDeveloper WHERE du.IdUser=@id',
      { id: Number(user.IdUser) },
    );

    const developer = devRows[0]
      ? { IdDeveloper: Number(devRows[0].IdDeveloper), NameDeveloper: String(devRows[0].NameDeveloper) }
      : null;

    const token = this.tokenService.signUser(user, developer);

    return {
      idUser: user.IdUser,
      emailUser: user.EmailUser,
      usernameUser: user.UsernameUser,
      imgAvatar: user.ImgAvatar ?? null,
      token,
    };
  }
}
