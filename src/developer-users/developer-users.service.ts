import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { DataStore, DuplicateKeyError, ForeignKeyError } from '../store/data-store';
import { DeveloperUserCreateDto } from './developer-users.dto';
import { DeveloperUsersMapper, DeveloperUserResponse } from './developer-users.mapper';

@Injectable()
export class DeveloperUsersService {
  constructor(private readonly dataStore: DataStore) {}

  async getAll(): Promise<DeveloperUserResponse[]> {
    const rows = await this.dataStore.select({
      table: 'DevelopersUsers',
    });
    return rows.map(r => DeveloperUsersMapper.toResponse(r));
  }

  async create(dto: DeveloperUserCreateDto): Promise<DeveloperUserResponse> {
    try {
      const inserted = await this.dataStore.insert('DevelopersUsers', {
        IdUser: dto.idUser,
        IdDeveloper: dto.idDeveloper,
        Rango: dto.rango ?? 0,
      });
      return DeveloperUsersMapper.toResponse(inserted);
    } catch (err) {
      if (err instanceof DuplicateKeyError) {
        throw new ConflictException('DeveloperUser already exists');
      }
      if (err instanceof ForeignKeyError) {
        throw new BadRequestException('Invalid user or developer id');
      }
      throw err;
    }
  }
}
