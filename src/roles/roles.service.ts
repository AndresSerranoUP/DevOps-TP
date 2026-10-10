import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../store/data-store';
import { RolesMapper, RoleResponse } from './roles.mapper';

@Injectable()
export class RolesService {
  constructor(private readonly dataStore: DataStore) {}

  async getAll(): Promise<RoleResponse[]> {
    const rows = await this.dataStore.select({
      table: 'Roles',
      orderBy: 'IdRole',
    });
    return rows.map(r => RolesMapper.toResponse(r));
  }

  async getById(id: number): Promise<RoleResponse> {
    const rows = await this.dataStore.select({
      table: 'Roles',
      where: { IdRole: id },
    });
    if (!rows[0]) {
      throw new NotFoundException('Role not found');
    }
    return RolesMapper.toResponse(rows[0]);
  }
}
