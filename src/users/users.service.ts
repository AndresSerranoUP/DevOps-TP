import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersMapper, UserResponse } from './users.mapper';
import { UserCreateDto, UserUpdateDto } from './users.dto';
import { PasswordHasher } from '../auth/password-hasher';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';
import { AppConfig } from '../config/app-config';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { PageResult } from '../common/pagination/page-result';
import { paginate } from '../common/pagination/paginate';
import { DataStore } from '../store/data-store';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly appConfig: AppConfig,
    private readonly dataStore: DataStore,
  ) {}

  async getAll(query: PageQueryDto): Promise<PageResult<UserResponse>> {
    return paginate(
      () => this.usersRepo.countAll(),
      async (offset, limit) => {
        const rows = await this.usersRepo.findPaged(
          offset,
          limit,
          query.orderBy || 'IdUser',
          query.ascending !== false,
        );
        return rows.map(r => UsersMapper.toResponse(r));
      },
      query,
      `${this.appConfig.publicApiUrl}/User/GetAll`,
    );
  }

  async getById(id: number): Promise<UserResponse> {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException('User was not found!');
    }
    return UsersMapper.toResponse(user);
  }

  async create(dto: UserCreateDto): Promise<string> {
    const existing = await this.usersRepo.findByEmail(dto.emailUser);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = this.passwordHasher.hash(dto.passwordUser, this.appConfig.encrypterKey);
    const hashUser = crypto.randomUUID();

    await this.usersRepo.create({
      EmailUser: dto.emailUser,
      PasswordUser: hashedPassword,
      UsernameUser: dto.usernameUser,
      ImgAvatar: dto.imgAvatar ?? null,
      HashUser: hashUser,
      IsVerified: false,
      IdRole: 1, // forced role 1
      Disabled: 0,
    });

    const verifyUrl = `${this.appConfig.publicApiUrl}/User/verify-email?email=${encodeURIComponent(dto.emailUser)}`;
    await this.mailService.sendVerificationEmail(dto.emailUser, verifyUrl);

    return 'User registered. Check your email for verification.';
  }

  async verifyEmail(email: string): Promise<boolean> {
    if (!email) {
      throw new BadRequestException('Invalid verification code or email.');
    }
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid verification code or email.');
    }
    if (user.IsVerified === true) {
      throw new BadRequestException('User was already verified!');
    }

    await this.usersRepo.update(Number(user.IdUser), {
      IsVerified: true,
      HashUser: null,
    });
    return true;
  }

  async passwordVerification(email: string): Promise<string> {
    if (email) {
      const user = await this.usersRepo.findByEmail(email);
      if (user) {
        const resetUrl = `${this.appConfig.frontendUrl}/reset-password?email=${encodeURIComponent(email)}`;
        await this.mailService.sendPasswordResetEmail(email, resetUrl);
      }
    }
    return 'If the account exists, a mail will be sent to that account!';
  }

  async updatePassword(id: number, password?: string, confirmPassword?: string): Promise<string> {
    if (!password || password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException('User was not found!');
    }

    const hashedPassword = this.passwordHasher.hash(password, this.appConfig.encrypterKey);
    await this.usersRepo.update(id, { PasswordUser: hashedPassword });

    return '<html><body>Password Changed!</body></html>';
  }

  async update(id: number, dto: UserUpdateDto): Promise<string> {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException('User was not found!');
    }

    const updateFields: Record<string, unknown> = {};
    if (dto.emailUser !== undefined) updateFields.EmailUser = dto.emailUser;
    if (dto.usernameUser !== undefined) updateFields.UsernameUser = dto.usernameUser;
    if (dto.imgAvatar !== undefined) updateFields.ImgAvatar = dto.imgAvatar;

    await this.usersRepo.update(id, updateFields);
    const updated = (await this.usersRepo.findById(id))!;

    const devRows = await this.dataStore.query<any>(
      'SELECT TOP 1 d.* FROM [Developers] d JOIN [DevelopersUsers] du ON du.IdDeveloper=d.IdDeveloper WHERE du.IdUser=@id',
      { id },
    );
    const developer = devRows[0]
      ? { IdDeveloper: Number(devRows[0].IdDeveloper), NameDeveloper: String(devRows[0].NameDeveloper) }
      : null;

    return this.tokenService.signUser({
      IdUser: Number(updated.IdUser),
      EmailUser: String(updated.EmailUser),
      UsernameUser: updated.UsernameUser ? String(updated.UsernameUser) : null,
      ImgAvatar: updated.ImgAvatar ? String(updated.ImgAvatar) : null,
      IdRole: updated.IdRole !== undefined && updated.IdRole !== null ? Number(updated.IdRole) : null,
    }, developer);
  }

  async delete(id: number): Promise<boolean> {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException('User was not found!');
    }
    await this.usersRepo.softDelete(id);
    return true;
  }
}
