import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStore } from '../store/data-store';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { PageResult } from '../common/pagination/page-result';
import { paginate } from '../common/pagination/paginate';
import { DeveloperCreateDto, DeveloperUpdateDto } from './developers.dto';
import { AppConfig } from '../config/app-config';
import { DevelopersMapper, DeveloperResponse } from './developers.mapper';

@Injectable()
export class DevelopersService {
  constructor(
    private readonly dataStore: DataStore,
    private readonly appConfig: AppConfig,
  ) {}

  async getAll(query: PageQueryDto): Promise<PageResult<DeveloperResponse>> {
    // Developers: sin filtrar disabled
    return paginate(
      () => this.dataStore.count({ table: 'Developers' }),
      async (offset, limit) => {
        const rows = await this.dataStore.select({
          table: 'Developers',
          offset,
          limit,
          orderBy: query.orderBy || 'IdDeveloper',
          ascending: query.ascending !== false,
        });
        return rows.map(r => DevelopersMapper.toResponse(r));
      },
      query,
      `${this.appConfig.publicApiUrl}/Developer/GetAll`,
    );
  }

  async getById(id: number): Promise<DeveloperResponse> {
    const rows = await this.dataStore.select({
      table: 'Developers',
      where: { IdDeveloper: id },
    });
    if (!rows[0]) {
      throw new NotFoundException('Developer was not found');
    }
    return DevelopersMapper.toResponse(rows[0]);
  }

  async getByName(name: string): Promise<DeveloperResponse[]> {
    const rows = await this.dataStore.query(
      'SELECT * FROM [Developers] WHERE [NameDeveloper] LIKE @name',
      { name: `%${name}%` },
    );
    return rows.map(r => DevelopersMapper.toResponse(r));
  }

  async create(dto: DeveloperCreateDto): Promise<DeveloperResponse> {
    const inserted = await this.dataStore.insert('Developers', {
      NameDeveloper: dto.nameDeveloper ?? '',
      LogoDeveloper: dto.logoDeveloper ?? '',
      LongDescription: dto.longDescription ?? '',
      ShortDescription: dto.shortDescription ?? '',
      Disabled: 0,
    });
    return DevelopersMapper.toResponse(inserted);
  }

  async update(id: number, dto: DeveloperUpdateDto): Promise<DeveloperResponse> {
    await this.getById(id);

    const values: Record<string, unknown> = {};
    if (dto.nameDeveloper !== undefined) values.NameDeveloper = dto.nameDeveloper;
    if (dto.logoDeveloper !== undefined) values.LogoDeveloper = dto.logoDeveloper;
    if (dto.longDescription !== undefined) values.LongDescription = dto.longDescription;
    if (dto.shortDescription !== undefined) values.ShortDescription = dto.shortDescription;

    const updated = await this.dataStore.update('Developers', { IdDeveloper: id }, values);
    const result = updated[0] ?? (await this.dataStore.select({ table: 'Developers', where: { IdDeveloper: id } }))[0];
    return DevelopersMapper.toResponse(result);
  }

  async delete(id: number): Promise<boolean> {
    await this.getById(id);
    await this.dataStore.update('Developers', { IdDeveloper: id }, { Disabled: 1 });
    return true;
  }
}
