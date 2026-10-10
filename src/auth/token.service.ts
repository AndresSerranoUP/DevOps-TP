import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config';

export interface TokenUserPayload {
  IdUser: number;
  EmailUser: string;
  UsernameUser?: string | null;
  ImgAvatar?: string | null;
  IdRole?: number | null;
  [key: string]: unknown;
}

export interface TokenDeveloperPayload {
  IdDeveloper: number;
  NameDeveloper: string;
}

export interface AuthJwtPayload {
  nameid: number;
  email: string;
  name: string;
  Avatar: string;
  role: string;
  Developer?: string;
  DeveloperId?: string;
  [key: string]: unknown;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfig,
  ) {}

  signUser(user: TokenUserPayload, developer?: TokenDeveloperPayload | null): string {
    const claims: Record<string, string | number> = {
      // .NET ClaimTypes URIs
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': String(user.IdUser),
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': String(user.EmailUser),
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': String(user.UsernameUser ?? ''),
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': String(user.IdRole ?? ''),

      // Short aliases
      nameid: Number(user.IdUser),
      email: String(user.EmailUser),
      name: String(user.UsernameUser ?? ''),
      Avatar: String(user.ImgAvatar ?? ''),
      role: String(user.IdRole ?? ''),
    };

    if (developer) {
      claims.Developer = String(developer.NameDeveloper);
      claims.DeveloperId = String(developer.IdDeveloper);
    }

    return this.jwtService.sign(claims, {
      secret: this.appConfig.jwtSecret,
      algorithm: 'HS256',
      expiresIn: this.appConfig.jwtExpirationMinutes * 60,
    });
  }

  verify(token: string): AuthJwtPayload {
    return this.jwtService.verify<AuthJwtPayload>(token, {
      secret: this.appConfig.jwtSecret,
      algorithms: ['HS256'],
    });
  }
}
